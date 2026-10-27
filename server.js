import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

const http = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
  }
});

app.get("/api/debug", async (req, res) => {

  try {

    const url =
      "https://www.bom.gov.au/qld/flood/networks/section3.shtml";

    const response =
      await http.get(url);

    const $ =
      cheerio.load(response.data);

    const rows = [];

    $("tr").each((_, row) => {

      const cols = [];

      $(row).find("td").each((__, col) => {
        cols.push(
          $(col).text().trim()
        );
      });

      if (cols.length) {
        rows.push(cols);
      }

    });

    res.json({
      title:
        $("title")
          .text()
          .trim(),
      rows:
        rows.slice(0, 50)
    });

  } catch (err) {

    res.status(500).json({
      error: err.message,
      status: err.response?.status
    });

  }

});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
