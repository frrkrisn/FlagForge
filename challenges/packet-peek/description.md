## Packet Peek

A colleague captured some traffic while logging in to the company intranet, then left the file on a shared drive.
The intranet does not use HTTPS.

Open `capture.pcap` and find the password that crossed the wire.

**Tools that help:** Wireshark (try *Follow → TCP Stream*), `tshark`, or even `strings`.

*The flag is the password, exactly as sent.*
