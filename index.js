const riteAids = [
  {
    chain: "rite-aid",
    address: "96 North Flowers Mill Road, Langhorne, PA 19047",
    storeNo: "11110",
  },
  {
    chain: "rite-aid",
    address: "1401 West Cheltenham Avenue, Melrose Park, PA 19027",
    storeNo: "2797",
  },
  {
    chain: "rite-aid",
    address: "1035 County Line Road, Huntingdon Valley, PA 19006",
    storeNo: "11096",
  },
  {
    chain: "rite-aid",
    address: "1039 2nd Street Pike, Richboro, PA 18954",
    storeNo: "11093",
  },
  {
    chain: "rite-aid",
    address: "1860 Brownsville Road, Trevose, PA 19053",
    storeNo: "923",
  },
  {
    chain: "rite-aid",
    address: "2182 County Line Road, Huntingdon Valley, PA 19006",
    storeNo: "11099",
  },
  {
    chain: "rite-aid",
    address: "599 York Road, Warminster, PA 18974",
    storeNo: "293",
  },
  {
    chain: "rite-aid",
    address: "1441 Old York Road, Abington, PA 19001",
    storeNo: "558",
  },
];

const axios = require("axios");
const FormData = require("form-data");
const winston = require("winston");
const player = require("play-sound")((opts = {}));
const axiosCookieJarSupport = require("axios-cookiejar-support").default;
const tough = require("tough-cookie");

axiosCookieJarSupport(axios);

const cookieJar = new tough.CookieJar();

const {
  combine,
  timestamp,
  label,
  prettyPrint,
  colorize,
  simple,
  cli,
  printf,
} = winston.format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

const logger = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
    success: 20,
  },
  format: combine(
    colorize({ colors: { info: "blue", success: "green" } }),
    timestamp(),
    myFormat
  ),
  transports: [new winston.transports.Console()],
});

const logSuccess = (message) => {
  playAlert();
  logger.warn(message);
};

const playAlert = () => {
  player.play("/System/Library/Sounds/Ping.aiff", function (err) {
    if (err) throw err;
  });
};

const checkCVS = async (state = "ma") => {
  logger.info(`Checking CVS in ${state} ...`);
  //First, hit the main page to get a session cookie or something:
  const init = await axios.get(
    "https://www.cvs.com/immunizations/covid-19-vaccine",
    {
      jar: cookieJar,
      withCredentials: true,
    }
  );

  //Next, get the state data

  const url = `https://www.cvs.com/immunizations/covid-19-vaccine.vaccine-status.${state}.json?vaccineinfo`;

  try {
    const resp = await axios.get(url, {
      jar: cookieJar,
      withCredentials: true,
      headers: {
        Referer: "https://www.cvs.com/immunizations/covid-19-vaccine",
      },
    });

    const locations = resp.data.responsePayloadData.data.MA;

    let result = false;

    locations.map((location) => {
      const { totalAvailable, city } = location;
      if (totalAvailable !== "0") {
        logSuccess(
          `Found ${totalAvailable} appointments available at CVS in ${city}. Visit https://www.cvs.com/immunizations/covid-19-vaccine`
        );
        result = true;
      }
    });
    return Promise.resolve(result);
  } catch (err) {
    logger.error(err);
    return Promise.reject(err);
  }
};

const checkRiteAid = async (storeId, address) => {
  logger.info(`Checking Rite Aid No. ${storeId} (${address})`);
  const url = "https://www.riteaid.com/services/ext/v2/vaccine/checkSlots";
  const resp = await axios.get(`${url}?storeNumber=${storeId}`);

  const { Status, Data } = resp.data;

  result = false;

  if (Status === "SUCCESS") {
    const { slots } = Data;
    result = slots["1"];
  }

  if (result === true) {
    logSuccess(`Found appointment at Rite Aid No. ${storeId} - ${address}`);
  }

  return Promise.resolve(result);
};

const checkWeissPharmacy = async () => {
  logger.info("Checking Weiss Pharmacy ...");
  const url = "https://c.ateb.com/appointments-full/";

  const resp = await axios.get(url);

  const html = resp.data;

  let result;

  if (/Appointments Full/.test(html)) {
    result = false;
  } else {
    logSucces(`Found appointment at Weiss Pharmacy`);
    result = true;
  }

  return Promise.resolve(result);
};

const checkGiantFoodStores = async () => {
  const url =
    "https://giantsched.rxtouch.com/rbssched/program/Covid19/Patient/CheckZipCode/";

  const cookieUrl =
    "https://giantsched.rxtouch.com/rbssched/program/covid19/Patient/Advisory";

  const form = new FormData();
  form.append("zip", 18966);
  form.append("appointmentType", "5958");
  form.append("PatientInterfaceMode", 0);

  const resp = await axios({
    url,
    data: form,
    headers: form.getHeaders(),
    method: "POST",
  });
};

const start = async () => {
  try {
    logger.info("Starting ...");
    await Promise.all([
      ...riteAids.map(
        async ({ address, storeNo }) => await checkRiteAid(storeNo, address)
      ),
      await checkWeissPharmacy(),
      await checkCVS("ma"),
    ]);
  } catch (err) {
    logger.error(err);
  }

  setTimeout(() => start(), 10 * 1000);
};

start();
