import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language":
    "en-AU,en;q=0.9",
  "Referer":
    "https://www.bom.gov.au/"
};

app.get("/api/status", (req, res) => {
  res.json({
    status: "online"
  });
});

app.get("/api/test-gauge", async (req, res) => {
  try {

    const url =
      "https://www.bom.gov.au/qld/flood/";

    const response = await axios.get(url, {
      headers: HEADERS,
      timeout: 30000,
      maxRedirects: 10
    });

    res.json({
      success: true,
      status: response.status,
      bytes: response.data.length
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      status: err.response?.status,
      message: err.message
    });

  }
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
