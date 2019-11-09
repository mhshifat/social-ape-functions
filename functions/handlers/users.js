const os = require("os");
const fs = require("fs");
const path = require("path");
const BusBoy = require("busboy");
const firebase = require("firebase");

const { db, admin } = require("../utils/admin");
const config = require("../utils/config");
const {
  validateLoginData,
  validateSignUpData,
  reduceUserDetails
} = require("../utils/validators");

exports.loginUser = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password
  };

  const { isValid, errors } = validateLoginData(user);
  if (!isValid) return res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then(token => {
      return res.status(200).json({ token });
    })
    .catch(err => {
      console.error(err);
      return res
        .status(400)
        .json({ general: "Wrong credentials, please try again!" });
    });
};

exports.signUpUser = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    handle: req.body.handle
  };
  let token, userId;

  const { isValid, errors } = validateSignUpData(newUser);
  if (!isValid) return res.status(400).json(errors);

  db.doc(`/users/${newUser.handle}`)
    .get()
    .then(snapshot => {
      if (snapshot.exists) {
        return res
          .status(400)
          .json({ handle: "this handle is already in use!" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then(data => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then(tokenId => {
      token = tokenId;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/no-image.png?alt=media`,
        userId
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch(err => {
      console.error(err);
      if (err.code.includes("email")) {
        return res.status(400).json({ email: "this email is already in use!" });
      } else if (err.code.includes("weak-password")) {
        return res
          .status(400)
          .json({ password: "please provide a strong password!" });
      } else {
        return res
          .status(500)
          .json({ general: "Something wen wrong, please try again later!" });
      }
    });
};

exports.getAuthenticatedUser = (req, res) => {
  const userData = {};

  db.doc(`/users/${req.user.handle}`)
    .get()
    .then(snapshot => {
      if (snapshot.exists) {
        userData.credentials = snapshot.data();
        return db
          .collection("likes")
          .where("userHandle", "==", req.user.handle)
          .get();
      }
    })
    .then(snapshot => {
      userData.likes = [];
      snapshot.forEach(doc => {
        userData.likes.push(doc.data());
      });
      return db
        .collection("notifications")
        .where("recipient", "==", req.user.handle)
        .limit(10)
        .get();
    })
    .then(data => {
      userData.notifications = [];
      data.forEach(doc => {
        userData.notifications.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          screamId: doc.data().screamId,
          type: doc.data().type,
          read: doc.data().read,
          notificationId: doc.id
        });
      });
      return res.status(200).json(userData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.getUserDetails = (req, res) => {
  const userData = {};

  db.doc(`/users/${req.params.handle}`)
    .get()
    .then(snapshot => {
      if (snapshot.exists) {
        userData.user = snapshot.data();
        return db
          .collection("screams")
          .where("userHandle", "==", req.params.handle)
          .get();
      } else {
        return res.status(404).json({ message: "User not found!" });
      }
    })
    .then(data => {
      userData.screams = [];
      data.forEach(doc => {
        userData.screams.push({
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          userHandle: doc.data().userHandle,
          userImage: doc.data().userImage,
          likeCount: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          body: doc.id
        });
      });
      return res.status(200).json(userData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.updateUser = (req, res) => {
  const userDetails = reduceUserDetails(req.body);

  db.doc(`/users/${req.user.handle}`)
    .update(userDetails)
    .then(() => {
      return res
        .status(200)
        .json({ message: "User details updated successfully!" });
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

exports.uploadImage = (req, res) => {
  const busboy = new BusBoy({ headers: req.headers });

  let imageFileName,
    fileToBeUploaded = {};

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    if (mimetype !== "image/png" && mimetype !== "image/jpeg")
      return res.status(400).json({
        message: "Please provide a valid image!"
      });

    const imageFileExtension = filename.split(".")[
      filename.split(".").length - 1
    ];
    imageFileName =
      Math.round(Math.random() * 1000000000000) + "." + imageFileExtension;
    const imageFilePath = path.join(os.tmpdir(), imageFileName);
    fileToBeUploaded = { imageFilePath, mimetype };
    file.pipe(fs.createWriteStream(imageFilePath));
  });

  busboy.on("finish", () => {
    admin
      .storage()
      .bucket(config.storageBucket)
      .upload(fileToBeUploaded.imageFilePath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: fileToBeUploaded.mimetype
          }
        }
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
        return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
      })
      .then(() => {
        return res
          .status(200)
          .json({ message: "Image uploaded successfully!" });
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({ error: err.code });
      });
  });

  busboy.end(req.rawBody);
};

exports.markNotificationsRead = (req, res) => {
  let batch = db.batch();
  req.body.forEach(notificationId => {
    const notification = db.doc(`/notifications/${notificationId}`);
    batch.update(notification, { read: true });
  });
  batch
    .commit()
    .then(() => {
      return res.status(200).json({ message: "Notifications marked read!" });
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
