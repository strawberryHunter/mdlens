import { describe, expect, it } from "vitest";
import type { Dataset } from "../dataset";
import { parseFile } from "./detect";

const q = (d: Dataset, name: string) => {
  const found = d.quantities.find((x) => x.name === name);
  if (!found) throw new Error(`no quantity ${name} in ${d.quantities.map((x) => x.name).join(", ")}`);
  return found;
};

const NAMD = `Info: NAMD 3.0 for Linux-x86_64-multicore
Info: TIMESTEP               2
Info: NUMBER OF STEPS        0
ETITLE:      TS           BOND          ANGLE          DIHED          IMPRP               ELECT            VDW       BOUNDARY           MISC        KINETIC               TOTAL           TEMP      POTENTIAL         TOTAL3        TEMPAVG            PRESSURE      GPRESSURE         VOLUME       PRESSAVG      GPRESSAVG

ENERGY:       0      5113.2391     13399.2102      8126.5432       312.4567        -251234.5678     20123.4567         0.0000         0.0000     55123.4567        -149021.0839       298.4567   -204144.5406   -148999.1234       298.4567            -12.3456       -10.1234    250000.0000       -12.3456       -10.1234

ENERGY:     500      5120.0000     13400.0000      8120.0000       310.0000        -251240.0000     20120.0000         0.0000         0.0000     55200.0000        -149000.0000       300.5000   -204200.0000   -149000.0000       299.5000              5.0000         4.0000    249900.0000        -3.0000        -3.0000
`;

const CHARMM = ` CHARMM>    dyna leap start nstep 200 timestep 0.001
DYNA DYN: Step         Time      TOTEner        TOTKe       ENERgy  TEMPerature
DYNA PROP:             GRMS      HFCTote        HFCKe       EHFCor        VIRKe
DYNA EWALD:          EWKSum       EWSElf       EWEXcl       EWQCor       EWUTil
DYNA PRESS:            VIRE         VIRI       PRESSE       PRESSI       VOLUme
 ----------       ---------    ---------    ---------    ---------    ---------
DYNA>        0      0.00000    -18.39430     87.30706   -105.70136    292.89942
DYNA PROP>          8.31339    -18.35353     87.29857      0.04077     13.43612
DYNA EWALD>        97.16924-207513.13059 201255.32717      0.00000      0.00000
DYNA PRESS>          13.906      -22.863       -0.012        0.032 76837499.996
 ----------       ---------    ---------    ---------    ---------    ---------
DYNA>      100      0.10000    -12.65469     78.32991    -90.98460    262.78269
DYNA PROP>          9.62861    -12.74691     78.33792     -0.09222   -513.69396
DYNA EWALD>        98.00000-207500.00000 201250.00000      0.00000      0.00000
DYNA PRESS>         346.296       -3.833       -0.309        0.043 76837499.996
 ----------       ---------    ---------    ---------    ---------    ---------
AVER>      100      0.10000      2.86298     66.40780    -63.54482    222.78617
FLUC>      100      0.10000     13.37077     11.46944     13.59573     38.47791
 CHARMM>    dyna leap start nstep 100 timestep 0.001
DYNA DYN: Step         Time      TOTEner        TOTKe       ENERgy  TEMPerature
DYNA>        0      0.00000    -10.00000     80.00000    -90.00000    270.00000
`;

const LAMMPS = `LAMMPS (2 Aug 2023)
units           real
timestep        2.0
thermo          500
run             1000
Per MPI rank memory allocation (min/avg/max) = 12.3 | 12.3 | 12.3 Mbytes
   Step          Temp          E_pair         E_mol          TotEng         Press
         0   300            -1234.5         56.7          -900.1         1.0
       500   301.2          -1240.1         57.0          -905.2        -10.5
WARNING: Bond/angle/dihedral extent > half of periodic box length (src/domain.cpp:933)
      1000   299.8          -1238.3         56.9          -903.3         5.5
Loop time of 1.234 on 4 procs for 1000 steps with 3000 atoms

run 1000
   Step          Temp          E_pair         E_mol          TotEng         Press          Density
      1000   299.8          -1238.3         56.9          -903.3         5.5            0.998
      1500   300.5          -1239.0         56.8          -904.0         2.0            0.999
Loop time of 1.1 on 4 procs for 500 steps with 3000 atoms
`;

const AMBER_FRAME = (step: number, time: number, temp: number) => ` NSTEP = ${String(step).padStart(8)}   TIME(PS) = ${time.toFixed(3).padStart(11)}  TEMP(K) = ${temp.toFixed(2).padStart(8)}  PRESS =    -9.1
 Etot   =    -67895.4375  EKtot   =     16693.8203  EPtot      =    -84589.2578
 BOND   =       512.6064  ANGLE   =      1310.0753  DIHED      =      1726.5039
 1-4 NB =       598.0587  1-4 EEL =      6866.0278  VDWAALS    =     10380.4185
 EELEC  =   -105983.0488  EHBOND  =         0.0000  RESTRAINT  =         0.0000
 EKCMT  =      7529.6875  VIRIAL  =      7577.6172  VOLUME     =    250683.8125
                                                    Density    =         1.0124
 ------------------------------------------------------------------------------
`;

const AMBER = `          -------------------------------------------------------
          Amber 22 PMEMD                              2022
          -------------------------------------------------------
${AMBER_FRAME(500, 101, 300.43)}
${AMBER_FRAME(1000, 102, 299.1)}

      A V E R A G E S   O V E R       2 S T E P S

${AMBER_FRAME(1000, 102, 299.77)}

      R M S  F L U C T U A T I O N S

${AMBER_FRAME(1000, 102, 0.66)}
`;

const OPENMM = `#"Step","Time (ps)","Potential Energy (kJ/mole)","Kinetic Energy (kJ/mole)","Temperature (K)","Box Volume (nm^3)","Density (g/mL)","Speed (ns/day)"
1000,2.0000000000000013,-123456.7,23456.7,299.5,123.4,1.01,--
2000,4.000000000000003,-123460.1,23460.2,300.1,123.5,1.009,250.3
`;

describe("parseFile engine detection", () => {
  it.each([
    ["equil.log", NAMD, "NAMD"],
    ["step4.out", CHARMM, "CHARMM"],
    ["log.lammps", LAMMPS, "LAMMPS"],
    ["prod.out", AMBER, "AMBER"],
    ["prod.csv", OPENMM, "OpenMM"],
    ["COLVAR", "#! FIELDS time d1\n0 1\n1 2\n", "PLUMED"],
    ["rmsd.xvg", '@    title "RMSD"\n0 0.1\n1 0.2\n', "GROMACS"],
    ["data.dat", "0 1\n1 2\n2 3\n", "Table"],
  ])("%s → %s", (name, text, engine) => {
    expect(parseFile(name, text).engine).toBe(engine);
  });
});

describe("NAMD", () => {
  const d = parseFile("equil.log", NAMD);

  it("turns steps into picoseconds using TIMESTEP", () => {
    expect([d.xName, d.xUnit]).toEqual(["Time", "ps"]);
    expect(q(d, "Temperature").x).toEqual([0, 1]);
  });

  it("names and units the ETITLE columns", () => {
    expect(q(d, "Temperature")).toMatchObject({ unit: "K", y: [298.4567, 300.5] });
    expect(q(d, "Pressure").unit).toBe("bar");
    expect(q(d, "Volume").unit).toBe("Å³");
    expect(q(d, "Potential energy").unit).toBe("kcal/mol");
  });
});

describe("CHARMM", () => {
  const d = parseFile("step4.out", CHARMM);

  it("reads DYNA frames and ignores AVER/FLUC", () => {
    expect(q(d, "Temperature").y).toEqual([292.89942, 262.78269, 270]);
  });

  it("joins runs whose clock restarts", () => {
    expect(q(d, "Temperature").x).toEqual([0, 0.1, 0.2]);
    expect(d.notes.join(" ")).toMatch(/2 dynamics runs/);
  });

  it("splits fixed-width numbers that run together", () => {
    expect(q(d, "Ewald self").y.slice(0, 2)).toEqual([-207513.13059, -207500]);
    expect(q(d, "Ewald k-space").y[0]).toBe(97.16924);
  });

  it("uses CHARMM units", () => {
    expect(q(d, "Pressure").unit).toBe("atm");
    expect(q(d, "Volume").unit).toBe("Å³");
    expect(q(d, "Potential energy").unit).toBe("kcal/mol");
  });
});

describe("LAMMPS", () => {
  const d = parseFile("log.lammps", LAMMPS);

  it("merges runs, skips the repeated boundary step and WARNING lines", () => {
    expect(q(d, "Temperature").x).toEqual([0, 1000, 2000, 3000]);
    expect(q(d, "Temperature").y).toEqual([300, 301.2, 299.8, 300.5]);
  });

  it("uses the units style for units and timestep for time", () => {
    expect(d.xUnit).toBe("fs");
    expect(q(d, "Pressure").unit).toBe("atm");
    expect(q(d, "Total energy").unit).toBe("kcal/mol");
    expect(q(d, "Density")).toMatchObject({ unit: "g/cm³", y: [NaN, NaN, NaN, 0.999] });
  });
});

describe("AMBER", () => {
  const d = parseFile("prod.out", AMBER);

  it("reads NSTEP blocks and skips averages and fluctuations", () => {
    expect(q(d, "Temperature")).toMatchObject({ x: [101, 102], y: [300.43, 299.1], unit: "K" });
  });

  it("reads keys with spaces and digits", () => {
    expect(q(d, "1-4 van der Waals").y[0]).toBe(598.0587);
    expect(q(d, "Density").unit).toBe("g/cm³");
  });
});

describe("tables", () => {
  it("reads OpenMM StateDataReporter CSV, preferring Time over Step", () => {
    const d = parseFile("prod.csv", OPENMM);
    expect([d.xName, d.xUnit]).toEqual(["Time", "ps"]);
    expect(q(d, "Potential energy").unit).toBe("kJ/mol");
    expect(q(d, "Volume").unit).toBe("nm³");
    expect(q(d, "Density").unit).toBe("g/cm³");
    expect(q(d, "Speed").y).toEqual([NaN, 250.3]);
    expect(d.quantities.some((x) => x.name === "Step")).toBe(false);
  });

  it("reads CHARMM-GUI's tab-separated OpenMM log with Progress and Time Remaining", () => {
    const text = `MD run: 125000 steps
#"Progress (%)"\t"Step"\t"Time (ps)"\t"Potential Energy (kJ/mole)"\t"Temperature (K)"\t"Speed (ns/day)"\t"Time Remaining"
0.8%\t1000\t1.0000000000000007\t-170705.41\t284.62\t0\t--
1.6%\t2000\t1.9999999999998905\t-167440.10\t300.93\t139\t1:16
`;
    const d = parseFile("step2.1_equilibration.out", text);
    expect(d.engine).toBe("OpenMM");
    expect(q(d, "Temperature").y).toEqual([284.62, 300.93]);
    expect(d.quantities.map((x) => x.name)).toEqual(["Potential energy", "Temperature", "Speed"]);
  });

  it("reads PLUMED FIELDS", () => {
    const d = parseFile("COLVAR", "#! FIELDS time d1 metad.bias\n#! SET min_d1 0\n 0.0 1.2 0.0\n 1.0 1.3 0.1\n");
    expect([d.xName, d.xUnit]).toEqual(["Time", "ps"]);
    expect(d.quantities.map((x) => x.name)).toEqual(["d1", "metad.bias"]);
  });

  it("takes names from the last comment line with the right width (cpptraj, fix ave/time)", () => {
    expect(parseFile("rmsd.dat", "#Frame     RMSD_00001\n       1       0.0000\n       2       0.5000\n").xName).toBe("Frame");
    const d = parseFile("ave.dat", "# Time-averaged data for fix 1\n# TimeStep c_t v_p\n100 1.0 2.0\n200 1.1 2.1\n");
    expect(d.quantities.map((x) => x.name)).toEqual(["c_t", "v_p"]);
  });

  it("finds nothing in prose", () => {
    expect(parseFile("job.log", "Starting job\nNode 3 ready\nDone in 5 s\n").quantities).toEqual([]);
  });
});

describe("GROMACS", () => {
  it("names a single series after the axis label", () => {
    const d = parseFile("sasa.xvg", '@    yaxis  label "Area (nm\\S2\\N)"\n@ s0 legend "Total"\n0 1\n1 2\n');
    expect(d.quantities[0]).toMatchObject({ name: "Area", unit: "nm²" });
  });

  it("assigns gmx energy units per term", () => {
    const d = parseFile(
      "energy.xvg",
      '@    xaxis  label "Time (ps)"\n@    yaxis  label "(K), (bar), (kg/m^3)"\n@ s0 legend "Temperature"\n@ s1 legend "Pressure"\n@ s2 legend "Density"\n0 300 1 1000\n',
    );
    expect(d.quantities.map((x) => [x.name, x.unit])).toEqual([
      ["Temperature", "K"],
      ["Pressure", "bar"],
      ["Density", "kg/m³"],
    ]);
  });

  it("uses canonical names for gmx energy terms", () => {
    const d = parseFile("pot.xvg", '@    yaxis  label "(kJ/mol)"\n@ s0 legend "Potential"\n0 -100\n1 -101\n');
    expect(d.quantities[0]).toMatchObject({ name: "Potential energy", unit: "kJ/mol" });
  });
});
