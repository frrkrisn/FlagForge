# OOP Concept → Code Mapping

The evaluator table from PLAYBOOK.md §5.2, tracked against real code. `file:line` references are
filled in as each phase lands (Phase 9 does a final pass). `TODO` = not yet implemented.

| OOP concept | Where (design intent) | Reference |
|---|---|---|
| **Encapsulation** | `Team::score_` derived/guarded; flag hash private in `Challenge`; password hash private in `User` | `include/ctf/core/Team.hpp` · `include/ctf/core/Challenge.hpp` · `include/ctf/core/User.hpp` — TODO:line |
| **Abstraction** | Abstract `User`, `Challenge`; interfaces `IScoringStrategy`, `IEventObserver` | TODO:line |
| **Inheritance** | `Player`/`Admin : User`; 3 challenge types : `Challenge`; `CtfException` hierarchy | TODO:line |
| **Polymorphism (runtime)** | `challenge->checkFlag(ctx,in)`, `strategy->pointsFor(ctx)`, `observer->onEvent(e)` | TODO:line |
| **Polymorphism (compile-time)** | `Repository<T>`, `crypto` function templates | TODO:line |
| **Composition / aggregation** | `Challenge` owns `Hint`s + strategy (composition); `Team` refs `Player` ids (aggregation); `CTFManager` owns all | TODO:line |
| **Operator overloading** | `Team::operator<`, friend `operator<<(ostream&,Team)`, `Submission::operator==`, `Team::operator+=` | TODO:line |
| **Templates** | `Repository<T>`, generic `filterBy(pred)` | `include/ctf/persistence/Repository.hpp` — TODO:line |
| **Friend function** | `operator<<(ostream&, const Team&)`; JSON serializers needing private access | TODO:line |
| **Static members** | `Challenge::nextId_`, `Submission::totalCount_`, `Team::kMaxSize` | TODO:line |
| **Exception handling** | Custom hierarchy thrown by core, mapped to HTTP by `ApiRouter` | `include/ctf/Exceptions.hpp` — TODO:line |
| **RAII / smart pointers** | `unique_ptr<Challenge>`, scoped locks, atomic file-write helper | TODO:line |
| **Rule of Five / move semantics** | `JsonStore` (owns path+buffer), `SessionManager` | TODO:line |
| **STL + lambdas** | `std::sort` comparators, `std::accumulate` for score, `std::find_if`, `unordered_map` | TODO:line |
| **Design patterns** | Strategy (scoring), Observer (events), Factory (challenges), Facade (`CTFManager`), Decorator (`FirstBloodScoring`) | TODO:line |
| **Namespaces / `enum class` / `const`** | `ctf::core/scoring/events/persistence/server`; `Category`, `Difficulty`, `SubmitResult`, `EventType`, `Role` | TODO:line |

> Update procedure: when a class is implemented, replace its `TODO:line` with the concrete
> `path:line` (e.g. `include/ctf/core/Team.hpp:57`) so the viva demo can jump straight to it.
