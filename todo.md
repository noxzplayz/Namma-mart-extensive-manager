# TODO for Implementing Shift Start/End Timestamps and Close Button

- [x] server.js
  - [x] Add store startShiftTime timestamp in /api/start-shift route.
  - [x] Add employee startShiftTime and set shiftEnded false in /api/verify-admin-approval-otp route.
  - [x] Add employee endShiftTime and set shiftEnded true in /api/verify-employee-otp route.

- [x] end_shift_report.html
  - [x] Add "Close" button that closes the window/tab.

- [x] view_report.html
  - [x] Verify display of employee startShiftTime and endShiftTime (linked to counter_data), ensure it is prominent.

- [ ] Verify with manual testing:
  - Start shift flow records store start time.
  - Employee relogin via admin approval sets employee startShiftTime.
  - Employee shift end OTP sets employee endShiftTime.
  - Reports (view_report.html and end_shift_report.html) show start and end times.
  - Close button in end_shift_report.html closes window.
