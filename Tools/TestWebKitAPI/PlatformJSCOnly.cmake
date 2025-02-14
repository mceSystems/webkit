set(TESTWEBKITAPI_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/TestWebKitAPI")
set(TESTWEBKITAPI_RUNTIME_OUTPUT_DIRECTORY_WTF "${TESTWEBKITAPI_RUNTIME_OUTPUT_DIRECTORY}/WTF")

include_directories(
    ${FORWARDING_HEADERS_DIR}
)

if (LOWERCASE_EVENT_LOOP_TYPE STREQUAL "glib")
    include_directories(SYSTEM
        ${GLIB_INCLUDE_DIRS}
    )
    list(APPEND TestWTF_SOURCES
        ${TESTWEBKITAPI_DIR}/glib/UtilitiesGLib.cpp
    )
else ()
    list(APPEND TestWTF_SOURCES
        ${TESTWEBKITAPI_DIR}/generic/UtilitiesGeneric.cpp
    )
endif ()

set(test_main_SOURCES
    ${TESTWEBKITAPI_DIR}/generic/main.cpp
)

list(APPEND TestWTF_SOURCES
    ${TESTWEBKITAPI_DIR}/Tests/WTF/RunLoop.cpp
)

if (WIN32)
    include_directories(SYSTEM
        ${ICU_INCLUDE_DIRS}
    )
    add_definitions(-DSTATICALLY_LINKED_WITH_WTF) 
endif ()