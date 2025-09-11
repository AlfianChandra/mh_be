import express from "express";
import meetingBuilder from "../controllers/meeting.controller.js";
const router = express.Router();
router.post("/meeting/create", meetingBuilder().createMeeting);
router.get("/meeting/get", meetingBuilder().getMeeting);
router.post("/meeting/updatecontent", meetingBuilder().updateMeetingContent);
router.post("/meeting/setactive", meetingBuilder().setActiveMeeting);
router.post("/meeting/delete", meetingBuilder().deleteMeeting);
router.post("/meeting/getsetting", meetingBuilder().getMeetingSetting);
router.post("/meeting/setsetting", meetingBuilder().setMeetingSetting);
router.post("/meeting/update/viewcontrol", meetingBuilder().updateSettingViewControl);

export default router;
