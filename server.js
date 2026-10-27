import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

const URL =
  "https://www.bom.gov.au/fwo/IDQ65388/IDQ65388.540230.plt.shtml";

const http = axios.create({
  timeout: 30000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
  }
});

app.get("/api/debug", async (req, res) => {

  try {

    const response =
      await http.get(URL);

    const html =
      response.data;

    res.json({
      length: html.length,
      first10000:
        html.substring(0, 10000)
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
