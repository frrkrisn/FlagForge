#include <stdio.h>

static const char *secret = "CTF{printf_gives_it_away}";

int main(int argc, char **argv) {
    (void)argv;
    puts("== FlagForge diagnostic tool v1.2 ==");
    puts("Status: all systems nominal.");
    if (argc > 4242) puts(secret); /* never taken */
    return 0;
}
