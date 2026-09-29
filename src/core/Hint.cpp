#include "ctf/core/Hint.hpp"

#include <utility>

#include "ctf/Exceptions.hpp"

namespace ctf {

Hint::Hint(HintId id, std::string text, int cost)
    : id_(std::move(id)), text_(std::move(text)), cost_(cost) {
    if (cost_ < 0) {
        throw ValidationException("Hint cost must be non-negative");
    }
}

}  // namespace ctf
