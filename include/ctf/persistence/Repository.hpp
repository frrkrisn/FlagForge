#ifndef CTF_PERSISTENCE_REPOSITORY_HPP
#define CTF_PERSISTENCE_REPOSITORY_HPP

/// \file Repository.hpp
/// \brief A generic, keyed, owning store — the project's Template showcase.
///        Works for any element type T exposing `id()` (returning something
///        constructible into std::string), whether concrete (Team) or polymorphic
///        base (User, Challenge stored as unique_ptr<Base>).
///
/// Header-only (templates). Pure storage + queries; no I/O.

#include <cstddef>
#include <memory>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include "ctf/Exceptions.hpp"

namespace ctf::persistence {

template <typename T>
class Repository {
public:
    using Key = std::string;
    using Pointer = std::unique_ptr<T>;

    Repository() = default;

    // Owning store: non-copyable, movable.
    Repository(const Repository&) = delete;
    Repository& operator=(const Repository&) = delete;
    Repository(Repository&&) noexcept = default;
    Repository& operator=(Repository&&) noexcept = default;

    /// Insert or replace. Key is item->id(). Throws on null.
    void add(Pointer item) {
        if (!item) {
            throw ValidationException("Repository::add received a null item");
        }
        Key key = item->id();
        items_[std::move(key)] = std::move(item);
    }

    /// Borrow by id, or nullptr if absent.
    T* get(const Key& id) {
        auto it = items_.find(id);
        return it == items_.end() ? nullptr : it->second.get();
    }
    const T* get(const Key& id) const {
        auto it = items_.find(id);
        return it == items_.end() ? nullptr : it->second.get();
    }

    /// Borrow by id or throw NotFoundException.
    T& at(const Key& id) {
        if (T* p = get(id)) return *p;
        throw NotFoundException("No such entity: " + id);
    }
    const T& at(const Key& id) const {
        if (const T* p = get(id)) return *p;
        throw NotFoundException("No such entity: " + id);
    }

    bool contains(const Key& id) const { return items_.count(id) != 0; }

    /// Remove by id; returns whether something was removed.
    bool remove(const Key& id) { return items_.erase(id) != 0; }

    std::size_t size() const noexcept { return items_.size(); }
    bool empty() const noexcept { return items_.empty(); }
    void clear() noexcept { items_.clear(); }

    /// All elements as non-owning pointers (unordered).
    std::vector<T*> all() {
        std::vector<T*> out;
        out.reserve(items_.size());
        for (auto& [_, ptr] : items_) out.push_back(ptr.get());
        return out;
    }
    std::vector<const T*> all() const {
        std::vector<const T*> out;
        out.reserve(items_.size());
        for (const auto& [_, ptr] : items_) out.push_back(ptr.get());
        return out;
    }

    /// Elements matching a predicate `bool(const T&)`. Function-template member →
    /// works with any callable / lambda.
    template <typename Predicate>
    std::vector<T*> findIf(Predicate pred) {
        std::vector<T*> out;
        for (auto& [_, ptr] : items_) {
            if (pred(*ptr)) out.push_back(ptr.get());
        }
        return out;
    }

    /// Apply `fn(T&)` to every element (used by (de)serialization).
    template <typename Fn>
    void forEach(Fn fn) {
        for (auto& [_, ptr] : items_) fn(*ptr);
    }

private:
    std::unordered_map<Key, Pointer> items_;
};

}  // namespace ctf::persistence

#endif  // CTF_PERSISTENCE_REPOSITORY_HPP
