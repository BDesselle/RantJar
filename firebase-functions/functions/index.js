const functions = require('firebase-functions');
const app = require('express')();
const config = require('./.config/index.js');

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(config.service_account),
    databaseURL: 'https://rantjar-a97f2.firebaseio.com'
});
const db = admin.firestore();

const firebase = require('firebase');
firebase.initializeApp(config.firebase_config);

app.get('/rants', (req, res) => {
    db.collection('rants').orderBy('createdAt', 'desc').get()
        .then(data => {
            let rants = [];
            data.forEach(doc => {
                rants.push({
                    rantId: doc.id,
                    body: doc.data().body,
                    userHandle: doc.data().userHandle,
                    createdAt: doc.data().createdAt
                });
            });
            return res.json(rants);
        })
        .catch(err => console.error(err))
});

app.post('/rant', (req, res) => {
    const newRant = {
        body: req.body.body,
        userHandle: req.body.userHandle,
        createdAt: new Date().toISOString()
    };

    db
    .collection('rants')
    .add(newRant)
    .then(doc =>{
        res.json({ message: `Document ${doc.id} created successfully.` });
    })
    .catch(err => {
        res.status(500).json({ error: 'Something went wrong.' });
        console.error(err);
    })
});

app.post('/signup', (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    // TODO: Validate Data
    let token, userId;
    db.doc(`/users/${newUser.handle}`)
        .get()
        .then((doc) => {
            if (doc.exists) {
                return res.status(400).json({ handle: `Handle ${newUser.handle} is already taken.` });
            } else {
                return firebase
                    .auth()
                    .createUserWithEmailAndPassword(newUser.email, newUser.password);
            }
        })
        .then((data) => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then((idToken) => {
            token = idToken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId
            };
            return db.doc(`/users/${newUser.handle}`).set(userCredentials);
        })
        .then(() => {
            return res.status(201).json({ token });
        })
        .catch((err) => {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                return res.status(400).json({ email: `Email ${newUser.email} is already in use.` });
            } else {
                return res.status(500).json({ error: err.code });
            }
        })
});

exports.api = functions.https.onRequest(app);