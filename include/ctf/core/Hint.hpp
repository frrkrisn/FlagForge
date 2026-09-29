#ifndef CTF_CORE_HINT_HPP
#define CTF_CORE_HINT_HPP

/// \file Hint.hpp
/// \brief A costed hint attached to a challenge. Value type; its text is never sent
///        to a team until they unlock it (docs/api.md §5.3).

#include <string>

#include "ctf/core/Types.hpp"

namespace ctf {

class Hint {
public:
    Hint(HintId id, std::string text, int cost);

    const HintId& id() const noexcept { return id_; }
    const std::string& text() const noexcept { return text_; }
    int cost() const noexcept { return cost_; }

private:
    HintId id_;
    std::string text_;
    int cost_;  // points deducted from the team on unlock (>= 0)
};

}  // namespace ctf

#endif  // CTF_CORE_HINT_HPP
