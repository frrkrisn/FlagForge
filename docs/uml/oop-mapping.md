# OOP Concept → Code Mapping

The evaluator table from PLAYBOOK.md §5.2, tracked against the real implementation.
References are `path:line` (line numbers as of the Phase 2–6 implementation; open the
file and search the named symbol if they drift).

| OOP concept | Where it lives |
|---|---|
| **Encapsulation** | `Team`'s records private, mutated only through methods — `include/ctf/core/Team.hpp:88`; flag hash private in `StaticChallenge` — `include/ctf/core/Challenge.hpp` (`flagHash_`); password hash + salt private in `User` — `include/ctf/core/User.hpp` (`passwordHash_`, `salt_`) |
| **Abstraction** | Abstract `User::role()` — `include/ctf/core/User.hpp:30`; abstract `Challenge::checkFlag()` — `include/ctf/core/Challenge.hpp:48`; interfaces `IScoringStrategy::pointsFor()` — `include/ctf/scoring/IScoringStrategy.hpp:31`; `IEventObserver::onEvent()` — `include/ctf/events/IEventObserver.hpp` |
| **Inheritance** | `Player`/`Admin : User` — `include/ctf/core/User.hpp`; `StaticChallenge`/`DynamicFlagChallenge`/`MultiFlagChallenge : Challenge` — `include/ctf/core/Challenge.hpp`; `CtfException` hierarchy — `include/ctf/Exceptions.hpp` |
| **Polymorphism (runtime)** | `challenge->checkFlag(ctx,in)` and `strategy->pointsFor(ctx)` in `CTFManager::submitFlag` — `src/app/CTFManager.cpp`; `observer->onEvent(e)` in `EventBus::publish` — `src/events/EventBus.cpp` |
| **Polymorphism (compile-time)** | `Repository<T>` — `include/ctf/persistence/Repository.hpp:24`; `crypto::toHex<ByteContainer>` — `include/ctf/core/Crypto.hpp` |
| **Composition / aggregation** | `Challenge` owns its `Hint`s + `IScoringStrategy` (composition) — `include/ctf/core/Challenge.hpp`; `Team` references `Player`s by id (aggregation) — `include/ctf/core/Team.hpp`; `CTFManager` owns every repository/bus/scoreboard — `include/ctf/app/CTFManager.hpp:150` |
| **Operator overloading** | `Team::operator+=` — `include/ctf/core/Team.hpp:79`; `Team::operator<` — `:83`; friend `operator<<` — `:86` / `src/core/Team.cpp`; `Submission::operator==` — `include/ctf/core/Submission.hpp` |
| **Templates** | `Repository<T>` (full impl) — `include/ctf/persistence/Repository.hpp:24`; member template `findIf(Predicate)` — same file |
| **Friend function** | `friend std::ostream& operator<<(std::ostream&, const Team&)` — `include/ctf/core/Team.hpp:86` |
| **Static members** | `Team::kMaxSize` — `include/ctf/core/Team.hpp:42`; `Challenge::nextId_` — `include/ctf/core/Challenge.hpp:106`; `Submission::totalCount_` — `include/ctf/core/Submission.hpp:39` |
| **Exception handling** | Custom hierarchy with `code()`/`httpStatus()` — `include/ctf/Exceptions.hpp`; thrown by core, mapped to HTTP by `ApiRouter::guarded` — `src/server/ApiRouter.cpp` |
| **RAII / smart pointers** | `std::unique_ptr<Challenge>` in `Repository`/factory; scoped `std::shared_lock`/`std::unique_lock` throughout `src/app/CTFManager.cpp`; atomic file write in `src/persistence/JsonStore.cpp` |
| **Rule of Five / move semantics** | `JsonStore` (copy deleted, move defined) — `include/ctf/persistence/JsonStore.hpp:26` / `src/persistence/JsonStore.cpp`; `SessionManager` non-copyable (owns a mutex) — `include/ctf/app/SessionManager.hpp` |
| **STL + lambdas** | `std::sort` comparator in `Scoreboard::buildRows` — `src/scoring/Scoreboard.cpp`; `std::any_of`/`std::find` in `src/core/Team.cpp`; `std::count_if`/`std::remove_if` in `src/events/EventBus.cpp` |
| **Design patterns** | Strategy — `include/ctf/scoring/ScoringStrategies.hpp`; Decorator — `FirstBloodScoring` `:33`; Observer — `include/ctf/events/EventBus.hpp`; Factory — `include/ctf/core/ChallengeFactory.hpp`; Facade — `include/ctf/app/CTFManager.hpp:52` |
| **Namespaces / `enum class` / `const`** | `ctf::{core,scoring,events,persistence,app,server}`; `Category`/`Difficulty`/`SubmitResult`/`EventState`/`Role` — `include/ctf/core/Types.hpp`; `EventType` — `include/ctf/events/Event.hpp` |
