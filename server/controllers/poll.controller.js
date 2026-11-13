const PollService = require('../services/poll.service');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

class PollController {
  /**
   * GET /api/polls — Workers/admins see active in-window polls by default;
   * admins may pass ?all=true to see drafts/closed/upcoming polls too.
   */
  static listPolls = asyncHandler(async (req, res) => {
    const includeAll = req.query.all === 'true' && req.user?.role === 'admin';
    const polls = await PollService.listPolls({ includeAll, userId: req.user?.userId });
    return res.json({ success: true, count: polls.length, data: polls });
  });

  /**
   * GET /api/polls/:id
   */
  static getPollById = asyncHandler(async (req, res) => {
    const poll = await PollService.getPollById(req.params.id, req.user?.userId);
    return ApiResponse.success(res, poll);
  });

  /**
   * POST /api/polls — Admin only
   */
  static createPoll = asyncHandler(async (req, res) => {
    const poll = await PollService.createPoll(req.body, req.user.userId);
    return res.status(201).json({ success: true, message: 'Poll created successfully.', data: poll });
  });

  /**
   * PATCH /api/polls/:id — Admin only
   */
  static updatePoll = asyncHandler(async (req, res) => {
    const poll = await PollService.updatePoll(req.params.id, req.body);
    return ApiResponse.success(res, poll, 'Poll updated successfully.');
  });

  /**
   * POST /api/polls/:id/vote — Worker only
   */
  static castVote = asyncHandler(async (req, res) => {
    const poll = await PollService.castVote(req.params.id, req.body.choice, req.user);
    return ApiResponse.success(res, poll, 'Your vote has been recorded.');
  });
}

module.exports = PollController;
