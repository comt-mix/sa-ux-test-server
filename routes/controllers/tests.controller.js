const createError = require("http-errors");
const ERROR = require("../../constants/error");
const fs = require("fs");
const Project = require("../../models/Project");
const Test = require("../../models/Test");
const puppeteer = require("puppeteer");
const { PuppeteerScreenRecorder } = require("puppeteer-screen-recorder");

exports.connectTest = (req, res, next) => {
  const uniqId = req.query.key;

  if (!uniqId) {
    next(createError(ERROR.FAILED_REQUEST));
  }

  fs.unlinkSync("public/javascripts/writeFile.js");

  const read = fs.createReadStream("public/javascripts/readFile.js");
  const write = fs.createWriteStream("public/javascripts/writeFile.js");

  write.on("close", () => {
    fs.appendFileSync(
      "public/javascripts/writeFile.js",
      `const key = "${uniqId}";`,
    );

    const source = fs.readFileSync("public/javascripts/writeFile.js", "utf8");

    res.send(source);
  });

  read.pipe(write);
};

exports.basicTest = async (req, res, next) => {
  const params = req.params.key;
  const event = req.query.event;
  const parseEvent = JSON.parse(event);

  try {
    const searchKey = await Project.findOne({ key: params });

    if (!searchKey) {
      next(createError(ERROR.FAILED_REQUEST));
    }

    const projectID = searchKey._id;
    const findID = await Test.findOne({ projectId: projectID });

    let visit = 1;

    if (!findID && parseEvent.name === "connect") {
      const newBasicTest = await new Test({
        projectId: projectID,
        basicEvent: {
          visit: visit,
          referrer: parseEvent.data.url,
          connectTime: new Date(),
          disconnectTime: new Date(),
          lastIp: parseEvent.data.lastIp,
        },
        mouseEvent: {
          tag: [],
          context: [],
        },
        video: {},
      });
      newBasicTest.save();
    }

    if (parseEvent === "disconnect") {
      await Test.updateMany(
        { projectId: findID.projectId },
        {
          $set: {
            "basicEvent.disconnectTime": new Date(),
          },
          $inc: {
            "basicEvent.visit": 1,
          },
        },
      );
    }

    res.end();
  } catch (error) {
    next(error);
  }
};

exports.mouseTest = async (req, res, next) => {
  const params = req.params.key;
  const event = req.query.event;
  const parseEvent = JSON.parse(event);

  try {
    const searchKey = await Project.findOne({ key: params });

    const findID = await Test.findOne({ projectId: searchKey._id });

    if (parseEvent.name === "click") {
      await Test.updateMany(
        { projectId: findID.projectId },
        {
          $push: {
            mouseEvent: {
              tag: parseEvent.data.tag,
              context: parseEvent.data.context,
            },
          },
        },
      );
    }

    res.end();
  } catch (error) {
    next(error);
  }
};

exports.videoTest = async (req, res, next) => {
  const params = req.params.key;

  (async () => {
    try {
      const browser = await puppeteer.launch({
        defaultViewport: {
          width: 1100,
          height: 1100,
          isLandscape: true,
        },
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        ignoreDefaultArgs: ["--disable-extensions"],
      });

      const page = await browser.newPage();
      const recorder = new PuppeteerScreenRecorder(page, {
        fps: 20,
      });

      await recorder.start(`./upload/${params}.mp4`);
      await page.goto("https://google.com");

      //---------**테스트 하는 사이트**----------//
      // await page.goto("https://scintillating-cassata-f06e40.netlify.app", {
      //   waitUntil: "networkidle2",
      // });

      await recorder.stop();
      await browser.close();

      const playVideo = (file) => {
        return URL.createObjectURL(file);
      };

      const fileUrl = playVideo(
        new Blob([`{${params}.mp4`], {
          type: "video/mp4",
        }),
      );
      const searchKey = await Project.findOne({ key: params });
      const findID = await Test.findOne({ projectId: searchKey._id });

      await Test.updateMany(
        { projectId: findID.projectId },
        {
          $push: {
            video: {
              fileUrl: fileUrl,
              createdAt: new Date(),
            },
          },
        },
      );
      res.send(`./upload/${params}.mp4`);
    } catch (err) {
      res.status(500).json(err);
    }
  })();
};

exports.getTestlist = async (req, res, next) => {
  const projectID = req.params.id;

  try {
    const tests = await Test.find({});
    const testlist = tests.filter((test) =>
      String(test.projectId === JSON.parse(projectID)),
    );

    res.json({ result: "success", testlist });
  } catch (error) {
    next(error);
  }
};

exports.getVideolist = async (req, res, next) => {
  const projectID = req.params.id;

  try {
    const tests = await Test.find({ projectId: JSON.parse(projectID) });

    res.json({ result: "success", tests });
  } catch (error) {
    next(error);
  }
};
