#include <catch2/catch_test_macros.hpp>

#include <nlohmann/json.hpp>

#include "ctf/persistence/JsonStore.hpp"
#include "support.hpp"

using namespace ctf::persistence;
using nlohmann::json;

TEST_CASE("JsonStore saves and loads atomically", "[persistence][jsonstore]") {
    const std::string path = ctftest::makeTempDir() + "/state.json";
    JsonStore store(path);
    REQUIRE_FALSE(store.exists());

    store.save(json{{"schemaVersion", 1}, {"teams", json::array()}, {"n", 42}});
    REQUIRE(store.exists());

    const json loaded = store.load();
    REQUIRE(loaded.at("n").get<int>() == 42);
    REQUIRE(loaded.at("teams").is_array());
}

TEST_CASE("JsonStore load of a missing file yields an empty object", "[persistence][jsonstore]") {
    JsonStore store(ctftest::makeTempDir() + "/absent.json");
    const json loaded = store.load();
    REQUIRE(loaded.is_object());
    REQUIRE(loaded.empty());
}

TEST_CASE("JsonStore is movable (Rule of Five)", "[persistence][jsonstore]") {
    const std::string path = ctftest::makeTempDir() + "/state.json";
    JsonStore a(path);
    a.save(json{{"v", 1}});
    JsonStore b = std::move(a);  // move construction
    REQUIRE(b.path() == path);
    REQUIRE(b.load().at("v").get<int>() == 1);

    JsonStore c(ctftest::makeTempDir() + "/other.json");
    c = std::move(b);  // move assignment
    REQUIRE(c.path() == path);
}

TEST_CASE("JsonStore overwrites on re-save", "[persistence][jsonstore]") {
    const std::string path = ctftest::makeTempDir() + "/state.json";
    JsonStore store(path);
    store.save(json{{"v", 1}});
    store.save(json{{"v", 2}});
    REQUIRE(store.load().at("v").get<int>() == 2);
}
