async function run() {
  const interestOutput = 35586.12;
  // B * (15 * r1 + 4 * (8.53 + rp3) + 12 * (8.28 + rp3)) / 365 = 35586.12
  // Let rp3 = -1.0 to 1.0
  // Let r1 = 3.0 to 6.0
  // Let B = 3000000 to 7000000
    // Try to find reasonable numbers

    for(let B = 2000000; B <= 10000000; B += 100) {
        // Let's assume rp3 = -2.0, r1 = 4.0?
        for(let rp3 = -3.0; rp3 <= 1.0; rp3 += 0.01) {
            for(let r1 = 1.0; r1 <= 6.0; r1 += 0.05) {
                let interest = B * ( (15 * r1/100) + (4 * (8.53 + rp3)/100) + (12 * (8.28 + rp3)/100) ) / 365;
                if (Math.abs(interest - 35586.12) < 0.01) {
                    console.log(`Found! B: ${B}, r1=${r1.toFixed(2)}, rp3=${rp3.toFixed(2)}, interest=${interest}`);
                    return;
                }
            }
        }
    }
}
run();
