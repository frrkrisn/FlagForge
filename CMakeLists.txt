cmake_minimum_required(VERSION 3.16)

project(FlagForge
    VERSION 0.1.0
    DESCRIPTION "CTF Competition Management System"
    LANGUAGES CXX)

# ---------------------------------------------------------------------------
# Global settings
# ---------------------------------------------------------------------------
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Some FetchContent dependencies (nlohmann/json, picosha2) still declare a
# cmake_minimum_required below 3.5, which CMake 4.0+ rejects. Raise the floor for
# those sub-projects so a plain `cmake -S . -B build` works on modern CMake.
if(NOT DEFINED CMAKE_POLICY_VERSION_MINIMUM)
    set(CMAKE_POLICY_VERSION_MINIMUM 3.5)
endif()

# Put all binaries in build/bin and build/lib so paths are predictable.
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Debug CACHE STRING "Build type" FORCE)
endif()

option(CTF_BUILD_TESTS "Build the Catch2 test suite" ON)
option(CTF_ENABLE_ASAN "Build with AddressSanitizer + UBSan (GCC/Clang)" OFF)
option(CTF_ENABLE_TSAN "Build with ThreadSanitizer (GCC/Clang)" OFF)

# ---------------------------------------------------------------------------
# Warnings: a reusable interface target (per CLAUDE.md hard rule #1)
# ---------------------------------------------------------------------------
add_library(ctf_warnings INTERFACE)
if(MSVC)
    target_compile_options(ctf_warnings INTERFACE /W4 /permissive-)
else()
    target_compile_options(ctf_warnings INTERFACE
        -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wsign-conversion)
endif()

# Sanitizers (opt-in; used in Phase 9 hardening).
add_library(ctf_sanitizers INTERFACE)
if(CTF_ENABLE_ASAN AND NOT MSVC)
    target_compile_options(ctf_sanitizers INTERFACE -fsanitize=address,undefined -fno-omit-frame-pointer)
    target_link_options(ctf_sanitizers INTERFACE -fsanitize=address,undefined)
endif()
if(CTF_ENABLE_TSAN AND NOT MSVC)
    target_compile_options(ctf_sanitizers INTERFACE -fsanitize=thread -fno-omit-frame-pointer)
    target_link_options(ctf_sanitizers INTERFACE -fsanitize=thread)
endif()

# Static runtime: on MinGW/GCC, link libstdc++/libgcc/winpthread statically so the
# executables are self-contained .exe files that need no MinGW DLLs on PATH. (Disabled
# under sanitizers, which require their shared runtimes.)
add_library(ctf_static_runtime INTERFACE)
if(MINGW AND NOT CTF_ENABLE_ASAN AND NOT CTF_ENABLE_TSAN)
    target_link_options(ctf_static_runtime INTERFACE -static -static-libgcc -static-libstdc++)
endif()

# ---------------------------------------------------------------------------
# Third-party dependencies via FetchContent (no manual installs)
# ---------------------------------------------------------------------------
include(FetchContent)
set(FETCHCONTENT_QUIET OFF)

# nlohmann/json ------------------------------------------------------------
FetchContent_Declare(nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.3
    GIT_SHALLOW TRUE)

# cpp-httplib (header-only) ------------------------------------------------
FetchContent_Declare(httplib
    GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
    GIT_TAG v0.15.3
    GIT_SHALLOW TRUE)

# picosha2 (single-header SHA-256) -----------------------------------------
FetchContent_Declare(picosha2
    GIT_REPOSITORY https://github.com/okdshin/PicoSHA2.git
    GIT_TAG 27fcf6979298949e8a462e16d09a0351c18fcaf2
    GIT_SHALLOW FALSE)

FetchContent_MakeAvailable(nlohmann_json httplib picosha2)

# picosha2 provides its own INTERFACE target `picosha2` (carrying its include dir),
# so we just link it below — no wrapper needed.

# Catch2 v3 (tests only) ---------------------------------------------------
if(CTF_BUILD_TESTS)
    FetchContent_Declare(Catch2
        GIT_REPOSITORY https://github.com/catchorg/Catch2.git
        GIT_TAG v3.7.1
        GIT_SHALLOW TRUE)
    FetchContent_MakeAvailable(Catch2)
endif()

# ---------------------------------------------------------------------------
# ctf_core : the pure domain library (core + scoring + events + persistence).
# NO I/O, no HTTP, no threads (CLAUDE.md rule #3). Sources are globbed so the
# library grows as each phase lands; CONFIGURE_DEPENDS re-globs on changes.
# ---------------------------------------------------------------------------
file(GLOB_RECURSE CTF_CORE_SOURCES CONFIGURE_DEPENDS
    ${CMAKE_CURRENT_SOURCE_DIR}/src/core/*.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/scoring/*.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/events/*.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/persistence/*.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/app/*.cpp)

add_library(ctf_core STATIC ${CTF_CORE_SOURCES})
target_include_directories(ctf_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
target_link_libraries(ctf_core
    PUBLIC  nlohmann_json::nlohmann_json picosha2
    PRIVATE ctf_warnings ctf_sanitizers)

# ---------------------------------------------------------------------------
# ctf_server : the REST server executable (server layer + main()).
# This is the ONLY place allowed to do I/O / HTTP.
# ---------------------------------------------------------------------------
file(GLOB_RECURSE CTF_SERVER_SOURCES CONFIGURE_DEPENDS
    ${CMAKE_CURRENT_SOURCE_DIR}/src/server/*.cpp)

add_executable(ctf_server ${CTF_SERVER_SOURCES})

# The server sources are template-heavy glue (nlohmann::json + cpp-httplib lambdas) and need a lot of
# RAM at -O2/-O3, which can exhaust a busy machine. They are not hot paths, so compile them with light
# optimisation and make GCC collect garbage aggressively. (The game logic in ctf_core stays optimised.)
if(NOT MSVC)
    set_source_files_properties(${CTF_SERVER_SOURCES} PROPERTIES
        COMPILE_OPTIONS "-O1;--param=ggc-min-expand=10;--param=ggc-min-heapsize=16384")
endif()
target_link_libraries(ctf_server
    PRIVATE ctf_core httplib::httplib nlohmann_json::nlohmann_json
            ctf_warnings ctf_sanitizers ctf_static_runtime)

# httplib needs sockets + threads.
find_package(Threads REQUIRED)
target_link_libraries(ctf_server PRIVATE Threads::Threads)
if(WIN32)
    target_link_libraries(ctf_server PRIVATE ws2_32)
endif()

# ---------------------------------------------------------------------------
# ctf_tests : Catch2 test executable, registered with CTest.
# ---------------------------------------------------------------------------
if(CTF_BUILD_TESTS)
    enable_testing()
    file(GLOB_RECURSE CTF_TEST_SOURCES CONFIGURE_DEPENDS
        ${CMAKE_CURRENT_SOURCE_DIR}/tests/*.cpp)

    add_executable(ctf_tests ${CTF_TEST_SOURCES})
    target_link_libraries(ctf_tests
        PRIVATE ctf_core Catch2::Catch2WithMain
                ctf_warnings ctf_sanitizers ctf_static_runtime)
    target_include_directories(ctf_tests PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/include)

    list(APPEND CMAKE_MODULE_PATH ${Catch2_SOURCE_DIR}/extras)
    include(Catch)
    catch_discover_tests(ctf_tests)
endif()

# ---------------------------------------------------------------------------
message(STATUS "FlagForge ${PROJECT_VERSION} configured "
        "(tests=${CTF_BUILD_TESTS}, asan=${CTF_ENABLE_ASAN}, tsan=${CTF_ENABLE_TSAN})")
