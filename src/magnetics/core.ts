/**
 * 磁芯几何库 + 波形感知损耗评估
 * （从仓库 llc_design/magnetics/core.py 移植）
 */

import { CORES, type CoreRecord } from '../data/cores.ts'
import {
  MaterialDatabase, bsatAt, igseDensityWM3, rangeWarnings, steinmetzDensityWM3,
  type CoreMaterial,
} from './material.ts'

export interface CoreSpec {
  partNumber: string
  shape: string
  family: string
  manufacturer: string
  standard: string
  materialKey: string
  purposes: string[]
  aeMm2: number
  aminMm2: number
  awMm2: number
  veMm3: number
  leMm: number
  windowWidthMm: number
  windowHeightMm: number
  mltPrimaryMm: number
  mltSecondaryMm: number
  centerLegWidthMm: number
  thermalResistanceKPerW: number
  coreMassG: number
  costUsd: number
  materialSpec: CoreMaterial

  readonly material: string
  readonly muR: number
  readonly bSatT: number
  readonly aeM2: number
  readonly aminM2: number
  readonly veM3: number
  readonly leM: number
  readonly windowWidthM: number
}

export function toCoreSpec(rec: CoreRecord, material: CoreMaterial): CoreSpec {
  return {
    partNumber: rec.partNumber,
    shape: rec.shape,
    family: rec.family,
    manufacturer: rec.manufacturer,
    standard: rec.standard,
    materialKey: rec.materialKey,
    purposes: rec.purposes,
    aeMm2: rec.aeMm2,
    aminMm2: rec.aminMm2,
    awMm2: rec.awMm2,
    veMm3: rec.veMm3,
    leMm: rec.leMm,
    windowWidthMm: rec.windowWidthMm,
    windowHeightMm: rec.windowHeightMm,
    mltPrimaryMm: rec.mltPrimaryMm,
    mltSecondaryMm: rec.mltSecondaryMm,
    centerLegWidthMm: rec.centerLegWidthMm,
    thermalResistanceKPerW: rec.thermalResistanceKPerW,
    coreMassG: rec.coreMassG,
    costUsd: rec.costUsd,
    materialSpec: material,
    get material() { return this.materialSpec.grade },
    get muR() { return this.materialSpec.muI25 },
    get bSatT() { return bsatAt(this.materialSpec, 100.0) },
    get aeM2() { return this.aeMm2 * 1e-6 },
    get aminM2() { return this.aminMm2 * 1e-6 },
    get veM3() { return this.veMm3 * 1e-9 },
    get leM() { return this.leMm * 1e-3 },
    get windowWidthM() { return this.windowWidthMm * 1e-3 },
  }
}

export function supports(core: CoreSpec, purpose: string): boolean {
  return core.purposes.includes(purpose)
}

/** 经典正弦 Steinmetz 结果（兼容） */
export function coreLossW(
  core: CoreSpec, frequencyHz: number, bPeakT: number, temperatureC = 100.0,
): number {
  return steinmetzDensityWM3(core.materialSpec, frequencyHz, bPeakT, temperatureC) * core.veM3
}

/** iGSE 波形损耗 */
export function coreLossWaveformW(
  core: CoreSpec, timeS: number[], fluxDensityT: number[], temperatureC = 100.0,
): number {
  return igseDensityWM3(core.materialSpec, timeS, fluxDensityT, temperatureC) * core.veM3
}

export function saturationFluxAt(core: CoreSpec, temperatureC: number): number {
  return bsatAt(core.materialSpec, temperatureC)
}

export function lossRangeWarnings(core: CoreSpec, frequencyHz: number, bPeakT: number): string[] {
  return rangeWarnings(core.materialSpec, frequencyHz, bPeakT)
}

export class CoreDatabase {
  private cores: CoreSpec[]
  private materialDb: MaterialDatabase

  constructor(records: CoreRecord[] = CORES, materials?: MaterialDatabase) {
    this.materialDb = materials ?? new MaterialDatabase()
    this.cores = records.map(rec => toCoreSpec(rec, this.materialDb.get(rec.materialKey)))
  }

  forPurpose(purpose: string, families?: string[]): CoreSpec[] {
    const familySet = families ? new Set(families.map(f => f.toLocaleLowerCase())) : null
    return this.cores.filter(core =>
      supports(core, purpose)
      && (familySet === null || familySet.has(core.family.toLocaleLowerCase())))
  }

  byFamily(family: string): CoreSpec[] {
    return this.cores.filter(core => core.family.toLocaleLowerCase() === family.toLocaleLowerCase())
  }

  get(partNumber: string): CoreSpec {
    for (const core of this.cores) {
      if (core.partNumber.toLocaleLowerCase() === partNumber.toLocaleLowerCase()) return core
    }
    throw new Error(`unknown core part number: ${partNumber}`)
  }

  get families(): string[] {
    return [...new Set(this.cores.map(core => core.family))].sort()
  }

  all(): CoreSpec[] {
    return this.cores
  }
}
