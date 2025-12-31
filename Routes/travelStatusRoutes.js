const express = require("express");
const router = express.Router();
const multer = require("multer");
const passport = require("passport");
const controller = require("../controllers/travelStatusController");


router.use(passport.authenticate("jwt", { session: false }));

// Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });


router.post("/import", upload.single("file"), controller.importExcel);
router.post("/", controller.getAll);
router.get("/importfiles", controller.getAllImports);
router.delete("/import/:importId", controller.deleteImport);



module.exports = router;
