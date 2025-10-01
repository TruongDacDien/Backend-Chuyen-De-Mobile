const User = require("../models/user.model");

exports.createUser = async (data) => {
  return await User.create(data);
};

exports.getAllUsers = async () => {
  return await User.find();
};
