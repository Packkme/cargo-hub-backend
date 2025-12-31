const TravelStatus = require("../models/TravelStatus");
const TravelStatusImport = require("../models/TravelStatusImport");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const { S3Client, PutObjectCommand,  DeleteObjectCommand } = require("@aws-sdk/client-s3");


exports.importExcel = async (req, res) => {
  try {
    const operatorId = req.user?.operatorId;
    if (!operatorId) {
      return res.status(400).json({ error: "Operator ID is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Excel file is required" });
    }

    /* ================= S3 ================= */
    const s3 = new S3Client({
      region: process.env.BUCKET_REGION,
      endpoint: process.env.BUCKET_ENDPOINT,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_Id,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const importId = new mongoose.Types.ObjectId();
    const filePath = `travel-status/${operatorId}/${importId}/${req.file.originalname}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: filePath,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      })
    );

    const fileUrl = `${process.env.BUCKET_ENDPOINT}/${process.env.BUCKET_NAME}/${filePath}`;

    /* ================= READ EXCEL ================= */
    const workbook = XLSX.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
      raw: false
    });

    const cleanText = (v) =>
      String(v || "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    let selectedRawData = null;
    let tripDate = null;

    for (const sheetName of workbook.SheetNames) {
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        defval: ""
      });

      // find trip date
      raw.forEach((row) => {
        row.forEach((cell) => {
          const text = cleanText(cell);
          if (text.includes("trip date")) {
            const match = text.match(/(\d{4}-\d{2}-\d{2})/);
            if (match) tripDate = new Date(match[1]);
          }
        });
      });

      // find PNR header
      if (raw.some((row) => row.some((c) => cleanText(c) === "pnr"))) {
        selectedRawData = raw;
        break;
      }
    }

    if (!selectedRawData) {
      return res.status(400).json({ error: "PNR column not found" });
    }

    if (!tripDate) {
      return res.status(400).json({ error: "Trip Date not found" });
    }

    /* ================= HEADERS ================= */
    const headerRowIndex = selectedRawData.findIndex((row) =>
      row.some((c) => cleanText(c) === "pnr")
    );

    const headers = selectedRawData[headerRowIndex].map(cleanText);
    const dataRows = selectedRawData.slice(headerRowIndex + 1);

    const rows = dataRows
      .filter((r) => r.some((c) => c !== ""))
      .map((row) => {
        const obj = {};
        headers.forEach((key, i) => {
          obj[key] = row[i] ?? "";
        });
        return obj;
      });

    /* ================= HEADER MAP ================= */
    const HEADER_MAP = {
      pnr: ["pnr"],
      route: ["route"],
      vehicleNumber: ["vehicle number"],
      driverName: ["driver name"],
      driverMobile: ["driver mobile"],
      status: ["status"],
      updatedBy: ["updated by"],
      seatName: ["seat name", "seat"],
      passengerName: ["passenger name"],
      passengerContact: ["passenger contact"],
      bookedBy: ["booked by"],
      boardingPoint: ["boarding point"],
      boardingTime: ["boarding time"]
    };

    const getValue = (row, keys) => {
      for (const key of keys) {
        let val = row[key];
        if (val !== undefined && val !== null && val !== "") {
          if (typeof val === "number") return Math.trunc(val).toString();
          return String(val).trim();
        }
      }
      return "";
    };

    /* ================= PNR VALIDATION (FINAL) ================= */
    const isValidPNR = (pnr) => {
      if (!pnr) return false;
      if (pnr instanceof Date) return false;

      const value = String(pnr).trim();

      // reject date/time strings
      if (value.includes("GMT") || value.includes(":")) return false;

     
      if (value.includes(" ")) return false;

      return /^[A-Za-z0-9]{3,}$/.test(value);
    };

    /* ================= FINAL NORMALIZATION ================= */
    const normalizedRows = rows
      .map((r) => {
        const rawPNR = getValue(r, HEADER_MAP.pnr);

        // ONLY rows starting with valid PNR
        if (!isValidPNR(rawPNR)) return null;

        return {
          ...r,
          pnr: rawPNR.trim(),
          seatName: getValue(r, HEADER_MAP.seatName),
          passengerName: getValue(r, HEADER_MAP.passengerName)
        };
      })
      .filter(Boolean);

    /* ================= FINAL DATA ================= */
    const finalData = normalizedRows.map((r) => ({
      operatorId,
      importId,
      tripDate,

      pnr: r.pnr,
      route: getValue(r, HEADER_MAP.route),
      vehicleNumber: getValue(r, HEADER_MAP.vehicleNumber),
      driverName: getValue(r, HEADER_MAP.driverName),
      driverMobile: getValue(r, HEADER_MAP.driverMobile),
      status: getValue(r, HEADER_MAP.status) || "Pending",
      updatedBy: getValue(r, HEADER_MAP.updatedBy),
      seatName: r.seatName,
      passengerName: r.passengerName,
      passengerContact: getValue(r, HEADER_MAP.passengerContact),
      bookedBy: getValue(r, HEADER_MAP.bookedBy),
      boardingPoint: getValue(r, HEADER_MAP.boardingPoint),
      boardingTime: getValue(r, HEADER_MAP.boardingTime)
    }));

    await TravelStatus.insertMany(finalData);

    await TravelStatusImport.create({
      _id: importId,
      operatorId,
      fileName: req.file.originalname,
      filePath,
      fileUrl,
      tripDate,
      totalRecords: finalData.length
    });

    return res.status(201).json({
      message: "Travel status imported successfully",
      importId,
      tripDate,
      totalRecords: finalData.length
    });
  } catch (error) {
    console.error("IMPORT ERROR:", error);
    return res.status(500).json({ error: "Failed to import Excel" });
  }
};




//  Get All Travel Status with Pagination
exports.getAll = async (req, res) => {
  try {
    const operatorId = req.user?.operatorId;
    const { tripDate, search } = req.body;

    if (!operatorId) {
      return res.status(400).json({ error: "Operator ID is required" });
    }

    if (!tripDate) {
      return res.status(400).json({ error: "tripDate is required" });
    }

    /* ===================== DATE RANGE ===================== */
    const start = new Date(tripDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(tripDate);
    end.setHours(23, 59, 59, 999);

    /* ===================== MATCH CONDITION ===================== */
    const matchStage = {
      operatorId,
      vehicleNumber: { $nin: ["", null] },
      tripDate: { $gte: start, $lte: end }
    };

    // Optional vehicle number search
    if (search && search.trim()) {
      matchStage.vehicleNumber = {
        $regex: search.trim(),
        $options: "i" // case-insensitive
      };
    }

    /* ===================== AGGREGATION ===================== */
    const groupedVehicles = await TravelStatus.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$vehicleNumber",
          vehicleNumber: { $first: "$vehicleNumber" },
          route: { $first: "$route" },
          tripDate: { $first: "$tripDate" },
          totalPnrs: { $sum: 1 },
          pnrs: {
            $push: {
              pnr: "$pnr",
              passengerName: "$passengerName",
              seatNo: "$seatName",
              status: "$status",
              boardingPoint: "$boardingPoint",
              boardingTime: "$boardingTime"
            }
          }
        }
      },
      { $sort: { vehicleNumber: 1 } }
    ]);

    return res.json({
      success: true,
      tripDate,
      totalVehicles: groupedVehicles.length,
      data: groupedVehicles
    });
  } catch (error) {
    console.error("POST GET ALL GROUPED ERROR:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch vehicle grouped data" });
  }
};


//Get all uploaded Excel files 
exports.getAllImports = async (req, res) => {
  try {
    const operatorId = req.user?.operatorId;

    if (!operatorId) {
      return res.status(400).json({ error: "Operator ID is required" });
    }

    const files = await TravelStatusImport.find({ operatorId })
      .select(
        "_id fileName filePath fileUrl tripDate totalRecords createdAt"
      )
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      totalFiles: files.length,
      data: files
    });

  } catch (error) {
    console.error("GET FILE PATHS ERROR:", error);
    res.status(500).json({ error: "Failed to fetch file paths" });
  }
};


exports.deleteImport = async (req, res) => {
  try {
    const operatorId = req.user?.operatorId;
    const { importId } = req.params;

    if (!operatorId) {
      return res.status(400).json({ error: "Operator ID is required" });
    }

    if (!importId) {
      return res.status(400).json({ error: "Import ID is required" });
    }

   
    const fileMeta = await TravelStatusImport.findOne({
      _id: importId,
      operatorId,
    });

    if (!fileMeta) {
      return res.status(404).json({ error: "File not found" });
    }

    //  Delete file from bucket
    const s3 = new S3Client({
      region: process.env.BUCKET_REGION,
      endpoint: process.env.BUCKET_ENDPOINT,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_Id,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: fileMeta.filePath, 
      })
    );

   
    await TravelStatus.deleteMany({ importId });

    await TravelStatusImport.deleteOne({ _id: importId });

    return res.json({
      success: true,
      message: "File and all related travel status data deleted successfully",
    });

  } catch (error) {
    console.error("DELETE IMPORT ERROR:", error);
    return res.status(500).json({
      error: "Failed to delete file and related data",
    });
  }
};





