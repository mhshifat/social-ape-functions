const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

const { db } = require("./utils/admin");

const isAuthenticated = require("./utils/isAuthenticated");
const {
  loginUser,
  signUpUser,
  uploadImage,
  updateUser,
  getAuthenticatedUser,
  getUserDetails,
  markNotificationsRead
} = require("./handlers/users");
const {
  getScreams,
  createScream,
  getScream,
  createComment,
  likeOnComment,
  unlikeOnComment,
  deleteScream
} = require("./handlers/screams");

const app = express();

app.use(cors("*"));

// Auth Routes...
app.route("/users/login").post(loginUser);
app.route("/users/signup").post(signUpUser);

// User routes
app
  .route("/user")
  .get(isAuthenticated, getAuthenticatedUser)
  .post(isAuthenticated, updateUser);

app.route("/user/:handle").get(getUserDetails);
app.route("/notifications").post(isAuthenticated, markNotificationsRead);

app.route("/user/image").post(isAuthenticated, uploadImage);

// Screams Routes...
app
  .route("/screams")
  .get(getScreams)
  .post(isAuthenticated, createScream);

app
  .route("/screams/:screamId")
  .get(isAuthenticated, getScream)
  .delete(isAuthenticated, deleteScream);
app.route("/screams/:screamId/comments").post(isAuthenticated, createComment);
app.route("/screams/:screamId/like").post(isAuthenticated, likeOnComment);
app.route("/screams/:screamId/unlike").post(isAuthenticated, unlikeOnComment);

exports.api = functions.region("europe-west1").https.onRequest(app);

exports.createNotificationOnLike = functions
  .region("europe-west1")
  .firestore.document("likes/{id}")
  .onCreate(snapshot => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: doc.data().userHandle,
            type: "like",
            read: false,
            screamId: doc.id
          });
        }
      })
      .catch(err => {
        console.error(err);
      });
  });

exports.deleteNotificationOnUnlike = functions
  .region("europe-west1")
  .firestore.document("likes/{id}")
  .onDelete(snapshot => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch(err => {
        console.error(err);
      });
  });

exports.createNotificationOnComment = functions
  .region("europe-west1")
  .firestore.document("comments/{id}")
  .onCreate(snapshot => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then(doc => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: doc.data().userHandle,
            type: "comment",
            read: false,
            screamId: doc.id
          });
        }
      })
      .catch(err => {
        console.error(err);
      });
  });

exports.onUserImageChange = functions
  .region("europe-west1")
  .firestore.document("users/{userId}")
  .onUpdate(change => {
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      const batch = db.batch();
      return db
        .collection("screams")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then(data => {
          data.forEach(doc => {
            const scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else {
      return true;
    }
  });

exports.onScreamDelete = functions
  .region("europe-west1")
  .firestore.document("users/{screamId}")
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("screamId", "==", screamId)
      .get()
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection("likes")
          .where("screamId", "==", screamId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("screamId", "==", screamId)
          .get();
      })
      .then(data => {
        data.forEach(doc => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch(err => {
        console.error(err);
      });
  });
