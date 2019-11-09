const { db } = require("../utils/admin");

exports.getScream = (req, res) => {
  let screamData = {};

  db.doc(`/screams/${req.params.screamId}`)
    .get()
    .then(snapshot => {
      if (!snapshot.exists)
        return res.status(404).json({ message: "Scream not found!" });
      screamData = snapshot.data();
      screamData.id = snapshot.id;
      return db
        .collection("comments")
        .where("screamId", "==", req.params.screamId)
        .get();
    })
    .then(snapshot => {
      screamData.comments = [];
      snapshot.forEach(doc => {
        screamData.comments.push(doc.data());
      });
      return res.status(200).json(screamData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.getScreams = (req, res) => {
  db.collection("screams")
    .orderBy("createdAt", "desc")
    .get()
    .then(snapshots => {
      const screams = [];
      snapshots.forEach(snapshot => {
        screams.push({
          screamId: snapshot.id,
          userHandle: snapshot.data().userHandle,
          body: snapshot.data().body,
          createdAt: snapshot.data().createdAt,
          likeCount: snapshot.data().likeCount,
          commentCount: snapshot.data().commentCount,
          userImage: snapshot.data().userImage
        });
      });
      return res.json(screams);
    })
    .catch(err => {
      console.error(err);
    });
};

exports.createScream = (req, res) => {
  if (!req.body.body)
    return res.status(400).json({ body: "Must not be empty!" });

  const newScream = {
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    body: req.body.body,
    createdAt: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0
  };

  db.collection("screams")
    .add(newScream)
    .then(createdScream => {
      const resScream = newScream;
      resScream.id = createdScream.id;
      return res.json(resScream);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({
        error: "something went wrong!"
      });
    });
};

exports.deleteScream = (req, res) => {
  const screamDoc = db.doc(`/screams/${req.params.screamId}`);
  screamDoc
    .get()
    .then(snapshot => {
      if (!snapshot.exists) {
        return res.status(404).json({ message: "Scream not found" });
      }
      if (snapshot.data().userHandle !== req.user.handle) {
        return res.status(400).json({ message: "Unauthorized" });
      }
      return screamDoc.delete();
    })
    .then(() => {
      return res.status(200).json({ message: "Scream deleted successfully" });
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.createComment = (req, res) => {
  if (!req.body.body)
    return res.status(400).json({ comment: "Must not be empty" });

  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    screamId: req.params.screamId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl
  };

  db.doc(`/screams/${req.params.screamId}`)
    .get()
    .then(snapshot => {
      if (!snapshot.exists) {
        return res.status(404).json({ message: "Scream does not exist!" });
      }

      return snapshot.ref.update({
        commentCount: snapshot.data().commentCount + 1
      });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then(() => {
      return res.status(201).json(newComment);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.likeOnComment = (req, res) => {
  const likeDoc = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", req.params.screamId)
    .limit(1);
  const screamDoc = db.doc(`/screams/${req.params.screamId}`);

  let screamData;

  screamDoc
    .get()
    .then(snapshot => {
      if (!snapshot.exists) {
        return res.status(404).json({ message: "Scream does not exist!" });
      }
      screamData = snapshot.data();
      screamData.id = snapshot.id;
      return likeDoc.get();
    })
    .then(data => {
      if (!data.empty) {
        return res.status(400).json({ message: "Scream already liked!" });
      } else {
        return db
          .collection("likes")
          .add({
            screamId: req.params.screamId,
            userHandle: req.user.handle
          })
          .then(() => {
            screamData.likeCount++;
            return screamDoc.update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            return res.status(200).json(screamData);
          });
      }
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.unlikeOnComment = (req, res) => {
  const likeDoc = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", req.params.screamId)
    .limit(1);
  const screamDoc = db.doc(`/screams/${req.params.screamId}`);

  let screamData;

  screamDoc
    .get()
    .then(snapshot => {
      if (!snapshot.exists) {
        return res.status(404).json({ message: "Scream does not exist!" });
      }
      screamData = snapshot.data();
      screamData.id = snapshot.id;
      return likeDoc.get();
    })
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ message: "Scream not liked!" });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            screamData.likeCount--;
            return screamDoc.update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            res.status(200).json(screamData);
          });
      }
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
