const { admin, db } = require("./admin");

module.exports = (req, res, next) => {
  let token = null;
  if (
    req.get("authorization") &&
    req.get("authorization").startsWith("Bearer ")
  )
    token = req.get("authorization").split(" ")[1];
  else res.status(403).json({ error: "Unauthorized!" });

  admin
    .auth()
    .verifyIdToken(token)
    .then(decodedToken => {
      req.user = decodedToken;
      return db
        .collection("users")
        .where("userId", "==", req.user.uid)
        .limit(1)
        .get();
    })
    .then(snapshot => {
      req.user.handle = snapshot.docs[0].data().handle;
      req.user.imageUrl = snapshot.docs[0].data().imageUrl;
      return next();
    })
    .catch(err => {
      console.error(err);
      return res.status(403).json({ error: "Unauthorized!" });
    });
};
