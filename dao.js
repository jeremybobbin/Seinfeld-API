let mySql = require('mysql');
const sqlInit = [];
sqlInit.push(
    `CREATE TABLE IF NOT EXISTS users (\
        token VARCHAR(255) PRIMARY KEY,\
        password VARCHAR(255)\
    ); `);
sqlInit.push(
    `CREATE TABLE IF NOT EXISTS leads (\
        id INT AUTO_INCREMENT PRIMARY KEY, \
        first VARCHAR(255),\
        last VARCHAR(255) \
    ); `);
sqlInit.push(
    `CREATE TABLE IF NOT EXISTS contexts (\
        id INT AUTO_INCREMENT PRIMARY KEY,\
        affiliate_id INT,\
        transaction_id INT,\
        campaign_id INT,\
        url VARCHAR(255),\
        user_agent VARCHAR(510),
        sub_one VARCHAR(255),\
        sub_two VARCHAR(255),\
        sub_three VARCHAR(255),\
        sub_four VARCHAR(255),\
        sub_five VARCHAR(255),\
        lead_id INT,
        FOREIGN KEY (lead_id) REFERENCES leads(id)\
    ); `);
sqlInit.push(
    `CREATE TABLE IF NOT EXISTS tags (\
        tag VARCHAR(255),\
        lead_id INT,
        FOREIGN KEY (lead_id) REFERENCES leads(id)\
    ); `);
sqlInit.push(
    `CREATE TABLE IF NOT EXISTS ip_addresses (\
        ip VARCHAR(255),\
        lead_id INT,
        FOREIGN KEY (lead_id) REFERENCES leads(id)\
    ); `);
sqlInit.push(
    `CREATE TABLE IF NOT EXISTS phone_numbers (\
        phone VARCHAR(255),\
        lead_id INT,
        FOREIGN KEY (lead_id) REFERENCES leads(id)\
    ); `);
sqlInit.push(
    `CREATE TABLE IF NOT EXISTS emails (\
        email VARCHAR(255),\
        lead_id INT,
        FOREIGN KEY (lead_id) REFERENCES leads(id)\
    ); `);

module.exports = class Dao {
    constructor(host = 'localhost', user = 'root', pass = '', db = 'seinfeld') {
        this.conn;
        this.init(host, user, pass, db);
    }

    query(sql) {
        return new Promise((resolve, reject) => {
            this.conn.query(sql, (err, result, fields) => err ? reject(err) : resolve(result));
        });
    }

    init(host, user, password, database) {
        this.conn = mySql.createConnection({host, user, password, database});
        this.conn.connect();
        sqlInit.forEach(query => {
            this.query(query).catch(err => console.log(err));
        });
    }

    authenticate(token = '', password = '') {
        token = token.replace(/\s/g, '');
        return this.query(`SELECT password FROM users WHERE token = '${token}'`)
            .then(result => {
                if(result[0] && result[0]['password'] !== password) {
                    throw 'Invalid username or password.';
                };
                if(result.length === 0) {
                    throw  'There is no account associated with that username';
                }
            });
    }

    getIdByIp(ip) {
        return this.query(
            `SELECT id FROM leads AS l JOIN ip_addresses AS ips ON l.id = ips.lead_id WHERE ip = ${ip};`
        );
    }

    //Get lead JSON object(s) by a value and column or a limit and skip.
    getLeadInfo(valOrLimit, colOrSkip = 'id') {
        let query = `SELECT l.id, first, last, ip, email, phone, tag FROM leads AS l \
            LEFT JOIN ip_addresses AS ips ON l.id = ips.lead_id \ 
            LEFT JOIN emails AS e ON l.id = e.lead_id \
            LEFT JOIN phone_numbers AS pn ON l.id = pn.lead_id \
            LEFT JOIN tags AS t ON l.id = t.lead_id `;

        query += typeof colOrSkip === 'number' ?
            `LIMIT ${valOrLimit}, ${colOrSkip}` : valOrLimit ?
                `WHERE l.${colOrSkip} = ${valOrLimit}` : '';
            
        query += ';';
        console.log(query);
        return this.query(query)
            .then(this.resultsToJson);
    }

    getContexts(valOrLimit, colOrSkip = 'id') {
        let query = `SELECT * FROM contexts `;
        console.log(query);
        query += typeof colOrSkip === 'number' ?
            `LIMIT ${valOrLimit}, ${colOrSkip}` : valOrLimit ?
                `WHERE ${colOrSkip} = ${valOrLimit}` : '';  
        query += ';';
        return this.query(query)
            .then(this.resultsToJson);
    }

    getIdByEmail(email) {
        return this.query(
            `SELECT id FROM leads WHERE email = '${email}';`
        );
    }

    identify(ip, userAgent, offerId, url, campId, transId, affId, subs) {
        let id;
        return this.getIdByIp(ip)
            .then(result => result.length === 0 ? this.insertLead() : result)
            .then(result => id = result['insertId'])
            .then(() => this.insertContext(id, campId, offerId, transId, affId, url, userAgent, subs))
            .then(() => id);
    }

    convert(id, first, last, phone, email, tags) {
        return this.getLeadInfo(id)
            .then(result => {
                console.log(result);
            });
    }

    insertLead(first = null, last = null) {
        return this.query(`INSERT INTO leads (first, last) VALUES ('${first}', '${last}')`);
    }
    
    insertEmail(id, email) {
        return this.insertByLeadId('emails', id, 'email', email);
    }

    insertPhone(id, phone) {
        return this.insertByLeadId('phone_numbers', id, 'phone', phone); 
    }

    insertIp(id, ip) {
        return this.insertByLeadId('ip_addresses', id, 'ip', ip);
    }

    insertTags(id, tags) {
        if(!Array.isArray(tags)) tags = [tags];
        let query = `INSERT INTO tags (lead_id, tag) VALUES `;
        const lastIndex = tags.length - 1;
        
        tags.forEach((tag, index) => {
            query += '(' + id + ', \'' + tag + '\')';
            query += index === lastIndex ? ';' : ', ';
        });

        return this.query(query);
    }

    insertContext(leadId, campId, offerId, transId, affId, url, userAgent, subs) {
        let query = 
            `INSERT INTO contexts \
            (lead_id, campaign_id, transaction_id, affiliate_id, url, user_agent, \
            sub_one, sub_two, sub_three, sub_four, sub_five) VALUES \
            (${leadId}, ${campId}, ${transId}, ${affId}, '${url}', '${userAgent}', \
            '${subs[0]}', '${subs[1]}', '${subs[2]}', '${subs[3]}', '${subs[4]}')`;
        return this.query(query);
        
    }

    insertByLeadId(table, id, column, value) {
        return this.query(`INSERT INTO ${table} (lead_id, ${column}) VALUES (${id}, '${value}')`);
    }

    putLead(ip, first, last, phone, email, tags) {
        this.getIdByIp(ip)
            .then(result => {
                if(result.length === 0) {
                    return this.insertNewLeadInfo(first, last, email, phone, ip, tags)
                } else if(first === result[0][first] && last === result[0][last]) {

                } else if(result[0][first] === NULL && result[0][first] === NULL) {
                    
                }
            });
    }

    insertNewLeadInfo(first, last, email, phone, ip, tags) {
        let id;
        return this.insertLead(first, last)
            .then(result => {
                id = result['insertId'];
                return this.insertEmail(id, email)
            })
            .then(() => this.insertPhone(id, phone))
            .then(() => this.insertIp(id, ip))
            .then(() => this.insertTags(id, tags));
    }

    removeDups(array) {
        return Array.from(new Set(array));
    }

    resultsToJson(results) {
        let pred = (id) => (obj) => obj['id'] === id;
        let jsonArr = [];
        let set = new Set();
        results.forEach(result => set.add(result['id']));
        set.forEach(v => {
            let obj = {};
            let resArr = results.filter(pred(v));
            resArr.forEach(resObj => {
                for(let prop in resObj) {
                    if(Array.isArray(obj[prop])) {
                        let val = obj[prop];
                        val.push(resObj[prop]);
                        obj[prop] = this.removeDups(val); 
                    } else if (obj[prop] && obj[prop] !== resObj[prop]) {
                        obj[prop] = [obj[prop], resObj[prop]];
                    } else {
                        obj[prop] = resObj[prop];
                    }
                }
            });
            jsonArr.push(obj);
        });
        return jsonArr;
    }

    form(str) {
        return str.toLowerCase().trim();
    }
}
