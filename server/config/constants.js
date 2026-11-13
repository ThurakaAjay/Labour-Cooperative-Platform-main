// Single source of truth for the cooperative's default locality/society values.
// Previously this literal was hardcoded independently in the User schema,
// AuthService.register, and the client registration form.
const DEFAULT_LOCALITY = 'Ward 4, Adyar, Chennai';
const DEFAULT_SOCIETY_ID = 'TN-CHE-2024-88402';

module.exports = { DEFAULT_LOCALITY, DEFAULT_SOCIETY_ID };
