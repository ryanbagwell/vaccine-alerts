function fixRequest(data) {
  const originalAppointmentAvailability = data.appointmentAvailability;
  const originalStartDate =
    originalAppointmentAvailability &&
    originalAppointmentAvailability.startDateTime;
  const requestedDate = new Date(originalStartDate);
  const requestedDay = requestedDate.getDate();
  const today = new Date();
  const todayDay = today.getDate();

  const targetDate = new Date(new Date().getTime() + 28 * 24 * 60 * 60 * 1000);
  console.log(targetDate);

  if (requestedDate > targetDate - 2) {
    data = {
      ...data,
      appointmentAvailability: {
        startDateTime: `2021-03-${todayDay - 2}`,
      },
    };
  }
  return data;
}

test("Will return correct date", () => {
  const payload = {
    appointmentAvailability: {
      startDateTime: "2021-03-25",
    },
  };

  const today = new Date();
  const todayDay = today.getDate();

  let resp = fixRequest(payload);

  expect(resp.appointmentAvailability.startDateTime).toBe(
    `2021-03-${todayDay - 2}`
  );

  resp = fixRequest({
    ...payload,
    appointmentAvailability: {
      startDateTime: "2021-03-15",
    },
  });

  expect(resp.appointmentAvailability.startDateTime).toBe("2021-03-15");
});
