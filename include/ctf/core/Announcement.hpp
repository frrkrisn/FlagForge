#ifndef CTF_CORE_ANNOUNCEMENT_HPP
#define CTF_CORE_ANNOUNCEMENT_HPP

/// \file Announcement.hpp
/// \brief An admin announcement shown as a live banner / in the notification bell.

#include <string>

#include "ctf/core/Types.hpp"

namespace ctf {

struct Announcement {
    AnnouncementId id;
    std::string title;
    std::string body;
    Severity severity = Severity::Info;
    TimePoint timestamp;
};

}  // namespace ctf

#endif  // CTF_CORE_ANNOUNCEMENT_HPP
