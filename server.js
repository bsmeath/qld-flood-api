import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3001;

app.get("/api/debug", async (req, res) => {

  try {

    const url =
      "http://131940.qld.gov.au/";

    const response =
      await axios.get(url, {
        timeout: 30000,
        maxRedirects: 10,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
        }
      });

    res.json({
      finalUrl:
        response.request?.res?.responseUrl,
      status:
        response.status,
      length:
        response.data.length,
      first2000:
        String(response.data)
          .substring(0, 2000)
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
  console.log(`Listening on ${PORT}`);
});
