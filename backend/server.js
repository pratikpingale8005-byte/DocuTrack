const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");
const fileRoutes = require("./routes/fileRoutes");
const tagRoutes = require("./routes/tagRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/tags", tagRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "DocuTrack API is running",
  });
});

const PORT = Number(process.env.BACKEND_PORT) || 5001;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error("BACKEND_PORT must be an integer from 1 to 65535");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`🚀 DocuTrack server running on http://localhost:${PORT}`);
});
