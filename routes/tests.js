const express = require("express");
const router = express.Router();
const {
  connectTest,
  basicTest,
  mouseTest,
} = require("./controllers/tests.controller");

router.get("/", connectTest);
router.post("/:key/basic", basicTest);
router.post("/:key/mouse", mouseTest);

module.exports = router;
