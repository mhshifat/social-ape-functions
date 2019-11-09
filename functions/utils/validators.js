const { isEmail, isEmpty } = require("./helpers");

exports.validateLoginData = user => {
  const errors = {};

  if (isEmpty(user.email)) errors.email = "Must not be empty!";
  if (isEmpty(user.password)) errors.password = "Must not be empty!";

  return {
    isValid: !Object.keys(errors).length,
    errors
  };
};

exports.validateSignUpData = newUser => {
  const errors = {};

  if (isEmpty(newUser.email)) errors.email = "Must not be empty!";
  else if (!isEmail(newUser.email))
    errors.email = "Please provide a valid email address!";

  if (isEmpty(newUser.password)) errors.password = "Must not be empty!";
  else if (newUser.password !== newUser.passwordConfirm)
    errors.passwordConfirm = "Passwords must match!";

  if (isEmpty(newUser.handle)) errors.handle = "Must not be empty";

  return {
    isValid: !Object.keys(errors).length,
    errors
  };
};

exports.reduceUserDetails = data => {
  const userDetails = {};

  if (!isEmpty(data.bio.trim())) userDetails.bio = data.bio;
  if (!isEmpty(data.website.trim())) {
    if (data.website.startsWith("http")) {
      userDetails.website = data.website;
    } else {
      userDetails.website = `http://${data.website}`;
    }
  }
  if (!isEmpty(data.location.trim())) userDetails.location = data.location;

  return userDetails;
};
