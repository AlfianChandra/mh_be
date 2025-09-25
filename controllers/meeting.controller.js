import Meeting from "../models/meeting.model.js";
import Hint from "../models/hint.model.js";
import HintStructure from "../models/hintstructure.model.js";
const meetingBuilder = () => {
  const createMeeting = async (req, res) => {
    try {
      const { title } = req.body;
      const id_user = req.user.id_user;
      const newMeeting = new Meeting({
        title,
        id_user,
        is_active: true,
      });

      //set other is_active to false
      await Meeting.updateMany(
        { id_user, is_active: true },
        { is_active: false }
      );

      await newMeeting.save();
      res
        .status(201)
        .json({ message: "Meeting created successfully", meeting: newMeeting });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const getMeeting = async (req, res) => {
    try {
      //Order by
      const meetings = await Meeting.find({ id_user: req.user.id_user }).sort({
        is_active: -1,
      });
      return res.status(200).json({ message: "ok", meeting: meetings });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const getMeetingData = async (req, res) => {
    try {
      const { id } = req.body;
      const meeting = await Meeting.findById(id).select("-createdAt -__v");
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      res.status(200).json({ message: "ok", payload: meeting });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const updateMeetingContent = async (req, res) => {
    try {
      const { id, raw, block } = req.body;
      const id_user = req.user.id_user;

      const updatedMeeting = await Meeting.findOneAndUpdate(
        { _id: id, id_user },
        { raw, block },
        { new: true }
      );

      if (!updatedMeeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      res.status(200).json({
        message: "Meeting updated successfully",
      });
    } catch (er) {
      console.error(er);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const setActiveMeeting = async (req, res) => {
    try {
      const { id } = req.body;
      const id_user = req.user.id_user;

      await Meeting.updateMany(
        { id_user, is_active: true },
        { is_active: false }
      );

      await Meeting.findByIdAndUpdate(id, { is_active: true });

      res.status(200).json({ message: "Meeting set to active successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const deleteMeeting = async (req, res) => {
    try {
      const { id } = req.body;
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      await Hint.deleteMany({ id_meeting: id });
      await Meeting.findByIdAndDelete(id);
      res
        .status(200)
        .json({ message: "Meeting and associated hints deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const getMeetingSetting = async (req, res) => {
    try {
      const { id } = req.body;
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      const setting = meeting.setting || null;
      res.status(200).json({ message: "ok", payload: setting });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const setMeetingSetting = async (req, res) => {
    try {
      const { id, viewControl } = req.body;
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      meeting.setting.viewControl = viewControl;
      await meeting.save();
      res.status(200).json({ message: "Setting updated successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const setMeetingLanguages = async (req, res) => {
    try {
      const { id, languages } = req.body;
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      meeting.setting.languages = languages;
      await meeting.save();
      res.status(200).json({ message: "Languages updated successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const setMeetingStructure = async (req, res) => {
    try {
      const { id_structure, id_meeting } = req.body;
      const meeting = await Meeting.findById(id_meeting);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }
      const structure = await HintStructure.findById(id_structure);
      if (!structure) {
        return res.status(404).json({ error: "Structure not found" });
      }

      meeting.setting.structure.id_structure = id_structure;
      await meeting.save();
      res.status(200).json({ message: "Structure updated successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  const updateSettingViewControl = async (req, res) => {
    try {
      const { id, viewControl } = req.body;
      const meeting = await Meeting.findById(id);
      if (!meeting) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      meeting.setting.viewControl = viewControl;
      await meeting.save();
      res.status(200).json({ message: "Setting updated successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  return {
    createMeeting,
    getMeeting,
    updateMeetingContent,
    setActiveMeeting,
    deleteMeeting,
    getMeetingSetting,
    setMeetingSetting,
    updateSettingViewControl,
    getMeetingData,
    setMeetingStructure,
    setMeetingLanguages,
  };
};

export default meetingBuilder;
