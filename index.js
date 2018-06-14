
const port = 3000;


let express = require('express');
let bodyParser = require('body-parser');
let Dao = require('./dao.js');

let app = express();
let dao = new Dao();

app.use(bodyParser.json());
   

app.get('/lead/identity', (req, res) => {
    let q = req.query;
    let subs = [q.subone, q.subtwo, q.subthree, q.subfour, q.subfive];
    dao.authenticate(q.token, q.password)
        .then(() => dao.identify(q.ip, q.useragent, q.offer_id, q.url, q.campaign_id, q.transaction_id, q.affiliate_id, subs))
        .then(results => res.json(results))
        .catch(res.send);
});

app.get('/lead/convert', (req, res) => {
    let q = req.query;
});

app.get('/leads', (req, res) => {
    let q = req.query;
    dao.authenticate(q.token, q.password)
        .then(() => dao.getLeadInfo())
        .then(results => res.json(results))
        .catch(err => res.json(err));
});

app.get('/context', (req, res) => {
    let q = req.query;
    dao.authenticate(q.token, q.password)
        .then(() => dao.getContexts)
        .then(results => res.json(results))
        .catch(err => res.json(err));
});

app.listen(port);
console.log("Running on port: " + port);