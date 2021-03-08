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
const { parse } = require("node-html-parser");

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

const checkNatickMall = async () => {
  logger.info("Checking natick mall ...");
  const tokenRequestUrl =
    "https://home.color.com/api/v1/get_onsite_claim?partner=natickmall";

  const tokenResponse = await axios.get(tokenRequestUrl);

  const { token } = tokenResponse.data;

  const url = `https://home.color.com/api/v1/vaccination_appointments/availability?claim_token=${token}&collection_site=Natick%20Mall`;

  const resp = await axios.get(url);

  const { remainingSpaces, dates } = resp.data.reduce(
    (final, current) => {
      final.remainingSpaces = final.remainingSpaces + current.remainingSpaces;
      if (current.remainingSpaces > 0) {
        final.dates = `${final.dates}; ${current.start}`;
      }
      return final;
    },
    {
      remainingSpaces: 0,
      dates: "",
    }
  );

  if (remainingSpaces > 0) {
    logSuccess(`Found appointments at the Natick Mall`);
    return Promise.resolve(true);
  }
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
      const { totalAvailable, city, status } = location;
      if (status !== "Fully Booked") {
        logSuccess(
          `Found appointments available at CVS in ${city}. Visit https://www.cvs.com/immunizations/covid-19-vaccine`
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

const checkMassVaxPortal = async (locationSlug, registrationLink = "") => {
  logger.info(`Checking ${locationSlug}`);
  const url = `https://vaxfinder.mass.gov/locations/${locationSlug}/`;

  const resp = await axios.get(url);

  const root = parse(resp.data);

  const rows = root.querySelectorAll(".availability-table table tbody tr");

  const rowArray = Array.from(rows);

  if (
    rowArray.length === 1 &&
    rowArray[0].querySelectorAll("td").length === 1
  ) {
    logger.info(`No appointments at ${locationSlug}`);
    return Promise.resolve(0);
  }

  const totalAppointments = Array.from(rows).reduce((final, current) => {
    try {
      const lastCell = Array.from(current.querySelectorAll("td")).reverse()[0];
      const available = lastCell.childNodes[0].childNodes[0].rawText;
      return final + parseInt(available);
    } catch (err) {
      return 0;
    }
  }, 0);

  if (totalAppointments > 0) {
    logSuccess(
      `Found ${totalAppointments} at ${locationSlug}: ${registrationLink}`
    );
  }

  return Promise.resolve(totalAppointments > 0);
};

const checkWalgreens = async (lat, lng, locationName, radius = 25) => {
  logger.info(`Checking Walgreens near ${locationName}`);

  const walgreensCookieJar = new tough.CookieJar();

  const initUrl =
    "https://www.walgreens.com/findcare/vaccination/covid-19/location-screening/";

  const initResp = await axios.get(initUrl, {
    jar: walgreensCookieJar,
    withCredentials: true,
  });

  const html = parse(initResp.data);

  const cookieMeta = html.querySelectorAll("meta").find((el) => {
    return el.getAttribute("name") === "_csrf";
  });

  const csrfToken = cookieMeta.getAttribute("content");

  const url =
    "https://www.walgreens.com/hcschedulersvc/svc/v1/immunizationLocations/availability";

  const today = new Date();

  const resp = await axios
    .post(
      url,
      {
        serviceId: "99",
        radius: radius,
        size: 25,
        state: "MA",
        position: {
          latitude: lat,
          longitude: lng,
        },
        appointmentAvailability: {
          startDateTime: today.toISOString().split("T")[0],
        },
      },
      {
        jar: walgreensCookieJar,
        withCredentials: true,
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "en-US,en;q=0.9",
          "cache-control": "no-cache",
          "content-type": "application/json; charset=UTF-8",
          pragma: "no-cache",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-xsrf-token": csrfToken,
          Referer: initUrl,
          origin: "https://www.walgreens.com",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.192 Safari/537.36",
        },
      }
    )
    .catch((err) => {
      console.log(err.response.data);
      //console.log(err.request.getHeaders());
    });

  const { appointmentsAvailable } = resp.data;

  if (appointmentsAvailable) {
    logSuccess(
      `Found appointments available at Walgreens near ${locationName}. See https://www.walgreens.com/findcare/vaccination/covid-19/location-screening`
    );
  }

  return Promise.resolve(appointmentsAvailable);
};

const start = async () => {
  try {
    logger.info("Starting ...");
    await Promise.all([
      // ...riteAids.map(
      //   async ({ address, storeNo }) => await checkRiteAid(storeNo, address)
      // ),
      // await checkWeissPharmacy(),
      await checkCVS("ma"),
      // await checkNatickMall(),
      // await checkMassVaxPortal(
      //   "fenway-park",
      //   "https://www.maimmunizations.org/clinic/search?location=&search_radius=All&q%5Bvenue_search_name_or_venue_name_i_cont%5D=fenway&q%5Bclinic_date_gteq%5D=&q%5Bvaccinations_name_i_cont%5D=&commit=Search#search_results"
      // ),
      // await checkMassVaxPortal(
      //   "gillette-stadium",
      //   "https://www.maimmunizations.org/clinic/search?location=&search_radius=All&q%5Bvenue_search_name_or_venue_name_i_cont%5D=gillette&q%5Bclinic_date_gteq%5D=&q%5Bvaccinations_name_i_cont%5D=&commit=Search#search_results#search_results"
      // ),
      //await checkMassVaxPortal("doubletree-hotel-danvers"),
      //await checkWalgreens(42.4573354, -71.0616623, "Melrose", 5),
      await checkWalgreens(42.6259, -73.108711, "Adams", 10),
    ]);
  } catch (err) {
    logger.error(err);
  }

  setTimeout(() => start(), 30 * 1000);
};

start();
