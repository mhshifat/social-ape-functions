const admin = require("firebase-admin");
const firebase = require("firebase");
const path = require("path");

const config = require("./config");

admin.initializeApp({
  credential: admin.credential.cert(path.join(__dirname, "..", "admin.json"))
});

firebase.initializeApp(config);

const db = admin.firestore();

module.exports = { admin, db };
