const mongoose = require("mongoose");


const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      unique: true,
      required: true,
    },
   
  },
  { timestamps: true }
);

module.exports =  mongoose.models.User || mongoose.model("User", userSchema);