const crypto = require('crypto');
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const ApiError = require('../utils/apiError');

// Vote tallies are never stored on the Poll document itself — they're always
// computed live from the Vote collection so there is exactly one source of
// truth for "how many yes/no votes does this poll have" and it can never
// drift out of sync with the actual vote records.
const attachTallies = async (polls, userId) => {
  const pollIds = polls.map(p => p.pollId);
  if (pollIds.length === 0) return [];

  const [tallyRows, myVotes] = await Promise.all([
    Vote.aggregate([
      { $match: { pollId: { $in: pollIds } } },
      { $group: { _id: { pollId: '$pollId', choice: '$choice' }, count: { $sum: 1 } } }
    ]),
    userId
      ? Vote.find({ pollId: { $in: pollIds }, workerId: userId }).select('pollId choice').lean()
      : Promise.resolve([])
  ]);

  const tallyByPoll = {};
  for (const row of tallyRows) {
    const { pollId, choice } = row._id;
    if (!tallyByPoll[pollId]) tallyByPoll[pollId] = { yesCount: 0, noCount: 0 };
    tallyByPoll[pollId][choice === 'yes' ? 'yesCount' : 'noCount'] = row.count;
  }
  const myVoteByPoll = Object.fromEntries(myVotes.map(v => [v.pollId, v.choice]));

  return polls.map(p => {
    const tallies = tallyByPoll[p.pollId] || { yesCount: 0, noCount: 0 };
    return {
      ...p,
      yesCount: tallies.yesCount,
      noCount: tallies.noCount,
      totalVotes: tallies.yesCount + tallies.noCount,
      myVote: myVoteByPoll[p.pollId] || null
    };
  });
};

class PollService {
  /**
   * List polls. Workers/admins default to only currently-active,
   * in-window polls; pass includeAll for the admin management view.
   */
  static async listPolls({ includeAll = false, userId } = {}) {
    const query = {};
    if (!includeAll) {
      const now = new Date();
      query.isActive = true;
      query.startsAt = { $lte: now };
      query.endsAt = { $gte: now };
    }

    const polls = await Poll.find(query).sort({ createdAt: -1 }).lean();
    return attachTallies(polls, userId);
  }

  static async getPollById(id, userId) {
    const poll = await Poll.findOne({ pollId: id }).lean();
    if (!poll) {
      throw new ApiError(404, `Poll with ID '${id}' not found`);
    }
    const [withTallies] = await attachTallies([poll], userId);
    return withTallies;
  }

  static async createPoll({ title, description, startsAt, endsAt, isActive }, createdBy) {
    if (!title?.trim() || !description?.trim()) {
      throw new ApiError(400, 'Title and description are required.');
    }

    const start = startsAt ? new Date(startsAt) : new Date();
    const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ApiError(400, 'startsAt / endsAt must be valid dates.');
    }
    if (end <= start) {
      throw new ApiError(400, 'endsAt must be after startsAt.');
    }

    const pollId = 'POLL-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const poll = await Poll.create({
      pollId,
      title: title.trim(),
      description: description.trim(),
      startsAt: start,
      endsAt: end,
      isActive: isActive === undefined ? true : Boolean(isActive),
      createdBy
    });

    return poll.toObject();
  }

  static async updatePoll(id, updates) {
    const allowed = {};
    if (updates.title !== undefined) allowed.title = updates.title.trim();
    if (updates.description !== undefined) allowed.description = updates.description.trim();
    if (updates.startsAt !== undefined) allowed.startsAt = new Date(updates.startsAt);
    if (updates.endsAt !== undefined) allowed.endsAt = new Date(updates.endsAt);
    if (updates.isActive !== undefined) allowed.isActive = Boolean(updates.isActive);

    const poll = await Poll.findOneAndUpdate({ pollId: id }, allowed, { returnDocument: 'after', runValidators: true }).lean();
    if (!poll) {
      throw new ApiError(404, `Poll with ID '${id}' not found`);
    }
    const [withTallies] = await attachTallies([poll]);
    return withTallies;
  }

  /**
   * Cast a worker's yes/no vote. Idempotency is enforced by Vote's unique
   * {pollId, workerId} index — a duplicate attempt fails at the database
   * layer (E11000) rather than a racy "check then insert".
   */
  static async castVote(pollId, choice, worker) {
    if (!['yes', 'no'].includes(choice)) {
      throw new ApiError(400, "Invalid choice: must be 'yes' or 'no'.");
    }

    const poll = await Poll.findOne({ pollId });
    if (!poll) {
      throw new ApiError(404, `Poll with ID '${pollId}' not found`);
    }

    const now = new Date();
    if (!poll.isActive || now < poll.startsAt || now > poll.endsAt) {
      throw new ApiError(403, 'This poll is not currently open for voting.');
    }

    try {
      await Vote.create({ pollId, workerId: worker.userId, workerName: worker.name || '', choice });
    } catch (err) {
      if (err.code === 11000) {
        throw new ApiError(409, 'You have already cast your vote on this poll.');
      }
      throw err;
    }

    return this.getPollById(pollId, worker.userId);
  }
}

module.exports = PollService;
