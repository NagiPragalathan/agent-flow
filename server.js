const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const agentRoutes = require("./routes/agentRoutes");

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000"
  })
);
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "zyflow-backend" });
});

app.use("/api", agentRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(port, () => {
  console.log(`ZyFlow backend running on port ${port}`);
});
