#ifndef CTF_CORE_FILETRANSFORM_HPP
#define CTF_CORE_FILETRANSFORM_HPP

/// \file FileTransform.hpp
/// \brief Per-team file personalisation. An attachment may declare a transform pipeline such
///        as "flag|xor|hex": operations applied in order to the stored bytes each time a team
///        downloads the file, so every team receives a different file (and a different answer).
///
/// Operations:
///   flag    replace every "{{FLAG}}" with the requesting team's own flag
///   xor     XOR every byte with a key derived from (server secret, challenge, team)
///   hex     lower-case hex encoding
///   base64  standard base64 with padding
///
/// Pure computation, no I/O (belongs in ctf::core).

#include <string>

namespace ctf {

/// Inputs a transform may need for one specific team.
struct TransformContext {
    std::string teamFlag;           ///< the team's per-team flag ("flag" op)
    unsigned char xorKey = 1;       ///< non-zero single-byte key ("xor" op)
};

/// "" and "none" are the identity. Otherwise ops separated by '|', each from the list above.
bool isValidTransform(const std::string& pipeline);

/// True if the pipeline is a real transform (not the identity).
bool isPersonalising(const std::string& pipeline);

/// Does the pipeline use the "flag" op (which needs a per-team-flag challenge)?
bool transformNeedsFlag(const std::string& pipeline);

/// Apply \p pipeline to \p bytes. Throws ValidationException on an invalid pipeline.
std::string applyTransform(const std::string& pipeline, std::string bytes, const TransformContext& ctx);

/// Non-zero XOR key unique to (challenge, team), derived from the server secret with HMAC.
unsigned char deriveXorKey(const std::string& serverSecret, const std::string& challengeId,
                           const std::string& teamId);

}  // namespace ctf

#endif  // CTF_CORE_FILETRANSFORM_HPP
