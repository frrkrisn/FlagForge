#include "ctf/core/FileTransform.hpp"

#include <sstream>
#include <vector>

#include "ctf/Exceptions.hpp"
#include "ctf/core/Crypto.hpp"

namespace ctf {

namespace {

std::vector<std::string> splitOps(const std::string& pipeline) {
    std::vector<std::string> ops;
    std::stringstream ss(pipeline);
    std::string op;
    while (std::getline(ss, op, '|')) {
        ops.push_back(op);
    }
    return ops;
}

bool knownOp(const std::string& op) {
    return op == "flag" || op == "xor" || op == "hex" || op == "base64";
}

std::string toBase64(const std::string& in) {
    static const char* kTable = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    out.reserve(((in.size() + 2) / 3) * 4);
    std::size_t i = 0;
    for (; i + 2 < in.size(); i += 3) {
        const unsigned v = (static_cast<unsigned char>(in[i]) << 16) |
                           (static_cast<unsigned char>(in[i + 1]) << 8) |
                           static_cast<unsigned char>(in[i + 2]);
        out.push_back(kTable[(v >> 18) & 63]);
        out.push_back(kTable[(v >> 12) & 63]);
        out.push_back(kTable[(v >> 6) & 63]);
        out.push_back(kTable[v & 63]);
    }
    if (i + 1 == in.size()) {
        const unsigned v = static_cast<unsigned char>(in[i]) << 16;
        out.push_back(kTable[(v >> 18) & 63]);
        out.push_back(kTable[(v >> 12) & 63]);
        out += "==";
    } else if (i + 2 == in.size()) {
        const unsigned v = (static_cast<unsigned char>(in[i]) << 16) |
                           (static_cast<unsigned char>(in[i + 1]) << 8);
        out.push_back(kTable[(v >> 18) & 63]);
        out.push_back(kTable[(v >> 12) & 63]);
        out.push_back(kTable[(v >> 6) & 63]);
        out.push_back('=');
    }
    return out;
}

std::string replaceAll(std::string text, const std::string& from, const std::string& to) {
    if (from.empty()) return text;
    std::size_t pos = 0;
    while ((pos = text.find(from, pos)) != std::string::npos) {
        text.replace(pos, from.size(), to);
        pos += to.size();
    }
    return text;
}

}  // namespace

bool isValidTransform(const std::string& pipeline) {
    if (pipeline.empty() || pipeline == "none") return true;
    for (const std::string& op : splitOps(pipeline)) {
        if (!knownOp(op)) return false;
    }
    return true;
}

bool isPersonalising(const std::string& pipeline) {
    return !pipeline.empty() && pipeline != "none";
}

bool transformNeedsFlag(const std::string& pipeline) {
    if (!isPersonalising(pipeline)) return false;
    for (const std::string& op : splitOps(pipeline)) {
        if (op == "flag") return true;
    }
    return false;
}

std::string applyTransform(const std::string& pipeline, std::string bytes, const TransformContext& ctx) {
    if (!isValidTransform(pipeline)) {
        throw ValidationException("Unknown file transform: " + pipeline);
    }
    if (!isPersonalising(pipeline)) return bytes;

    for (const std::string& op : splitOps(pipeline)) {
        if (op == "flag") {
            bytes = replaceAll(std::move(bytes), "{{FLAG}}", ctx.teamFlag);
        } else if (op == "xor") {
            for (char& c : bytes) c = static_cast<char>(static_cast<unsigned char>(c) ^ ctx.xorKey);
        } else if (op == "hex") {
            bytes = crypto::toHex(bytes);
        } else if (op == "base64") {
            bytes = toBase64(bytes);
        }
    }
    return bytes;
}

unsigned char deriveXorKey(const std::string& serverSecret, const std::string& challengeId,
                           const std::string& teamId) {
    const std::string mac = crypto::hmacSha256Hex(serverSecret, "xor:" + challengeId + ":" + teamId);
    const int byte = std::stoi(mac.substr(0, 2), nullptr, 16);
    return static_cast<unsigned char>(byte % 255 + 1);  // 1..255: a zero key would be a no-op
}

}  // namespace ctf
