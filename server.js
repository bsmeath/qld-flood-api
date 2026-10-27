import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

const TEST_URL =
  "https://www.bom.gov.au/fwo/IDQ65388/IDQ65388.540230.tbl.shtml";

app.get("/api/debug", async (req, res) => {
  try {

    const response =
      await axios.get(TEST_URL, {
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
        }
      });

    const html = response.data;

    const interesting = [];

    const lines = html.split("\n");

    for (const line of lines) {

      const lower =
        line.toLowerCase();

      if (
        lower.includes("data") ||
        lower.includes("series") ||
        lower.includes("plot") ||
        lower.includes("height") ||
        lower.includes("river") ||
        lower.includes("csv") ||
        lower.includes("javascript") ||
        lower.includes("array") ||
        lower.includes("threshold") ||
        lower.includes("major") ||
        lower.includes("moderate") ||
        lower.includes("minor")
      ) {
        interesting.push(line.trim());
      }
    }

    res.json({
      matches: interesting.length,
      lines: interesting.slice(0, 200)
    });

  } catch (err) {

    res.status(500).json({
      status: err.response?.status,
      message: err.message
    });

  }
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
