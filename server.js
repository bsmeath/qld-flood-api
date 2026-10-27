import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

const TEST_URL =
  "https://www.bom.gov.au/fwo/IDQ65388/IDQ65388.540230.plt.shtml";

const http = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
  }
});

app.get("/api/live-test", async (req, res) => {

  try {

    const response =
      await http.get(TEST_URL);

    const $ =
      cheerio.load(response.data);

    const title =
      $("title").text();

    const rows = [];

    $("tr").each((_, tr) => {

      const cols = [];

      $(tr).find("td").each((__, td) => {

        cols.push(
          $(td).text().trim()
        );

      });

      if (cols.length) {
        rows.push(cols);
      }

    });

    res.json({
      title,
      tablesFound:
        rows.length,
      sample:
        rows.slice(0, 30)
    });

  } catch (err) {

    res.status(500).json({
      status:
        err.response?.status,
      message:
        err.message
    });

  }

});

app.listen(PORT, () => {
  console.log(
    `Listening on ${PORT}`
  );
});
