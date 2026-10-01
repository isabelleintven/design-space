// Lokale opslag in de browser (IndexedDB). Niets verlaat de computer.
import { openDB } from 'idb'

const dbPromise = openDB('design-space', 1, {
  upgrade(db) {
    db.createObjectStore('projects', { keyPath: 'id' })
    db.createObjectStore('presets', { keyPath: 'id' })
    db.createObjectStore('blobs') // key = blobId, value = Blob
  },
})

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

// ---------- Projecten ----------

export function emptyProject(data = {}) {
  const now = new Date().toISOString()
  return {
    id: uid(),
    name: '',
    client: '',
    deadline: '',
    briefing: '',
    presetId: '',
    files: [], // { id, name, versions: [{ id, blobId, originalName, size, type, addedAt, note }] }
    checklists: [], // { id, title, source, createdAt, items: [{ id, text, done, page, kind }] }
    exports: [], // { id, name, createdAt, size, fileCount }
    createdAt: now,
    updatedAt: now,
    ...data,
  }
}

export async function listProjects() {
  const all = await (await dbPromise).getAll('projects')
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getProject(id) {
  return (await dbPromise).get('projects', id)
}

export async function saveProject(project) {
  const p = { ...project, updatedAt: new Date().toISOString() }
  await (await dbPromise).put('projects', p)
  return p
}

export async function deleteProject(project) {
  const db = await dbPromise
  const tx = db.transaction(['projects', 'blobs'], 'readwrite')
  for (const f of project.files) for (const v of f.versions) tx.objectStore('blobs').delete(v.blobId)
  tx.objectStore('projects').delete(project.id)
  await tx.done
}

// ---------- Bestanden ----------

export async function putBlob(blob) {
  const id = uid()
  await (await dbPromise).put('blobs', blob, id)
  return id
}

export async function getBlob(id) {
  return (await dbPromise).get('blobs', id)
}

export async function deleteBlob(id) {
  return (await dbPromise).delete('blobs', id)
}

/** Haalt een versie op als File-object (met originele naam). */
export async function versionToFile(version) {
  const blob = await getBlob(version.blobId)
  if (!blob) return null
  return new File([blob], version.originalName, { type: version.type || blob.type })
}

/**
 * Voegt een bestand toe aan het project. Bestaat er al een bestand met dezelfde
 * (logische) naam, dan wordt het een nieuwe versie van dat bestand.
 */
export async function addFileToProject(project, file, { logicalName, note = '' } = {}) {
  const blobId = await putBlob(file)
  const version = {
    id: uid(),
    blobId,
    originalName: file.name,
    size: file.size,
    type: file.type,
    addedAt: new Date().toISOString(),
    note,
  }
  const name = logicalName || baseName(file.name)
  const files = [...project.files]
  const idx = files.findIndex((f) => f.name.toLowerCase() === name.toLowerCase())
  if (idx >= 0) files[idx] = { ...files[idx], versions: [...files[idx].versions, version] }
  else files.push({ id: uid(), name, versions: [version] })
  return { ...project, files }
}

/** "Folder_V2.pdf" → "Folder", zodat versies van hetzelfde bestand bij elkaar komen. */
export function baseName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[\s_-]*(v|versie|version)[\s_-]?\d+$/i, '')
    .trim() || filename
}

// ---------- Klantpresets ----------

export function emptyPreset(data = {}) {
  return {
    id: uid(),
    client: '',
    namingPattern: '{klant}_{project}_{naam}_v{versie}',
    separator: '_',
    lowercase: false,
    pdf: { width: 210, height: 297, bleed: 3, minDpi: 300, requireEmbeddedFonts: true, requireCmyk: true },
    notes: '',
    ...data,
  }
}

export async function listPresets() {
  const all = await (await dbPromise).getAll('presets')
  return all.sort((a, b) => a.client.localeCompare(b.client))
}

export async function getPreset(id) {
  if (!id) return null
  return (await dbPromise).get('presets', id)
}

export async function savePreset(preset) {
  await (await dbPromise).put('presets', preset)
  return preset
}

export async function deletePreset(id) {
  return (await dbPromise).delete('presets', id)
}

// ---------- Project delen (export / import als .dspace) ----------

export async function exportProjectFile(project) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const preset = await getPreset(project.presetId)
  zip.file('project.json', JSON.stringify({ format: 'design-space-project', version: 1, project, preset }, null, 2))
  for (const f of project.files) {
    for (const v of f.versions) {
      const blob = await getBlob(v.blobId)
      if (blob) zip.file(`blobs/${v.blobId}`, blob)
    }
  }
  return zip.generateAsync({ type: 'blob' })
}

export async function importProjectFile(file) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(file)
  const meta = JSON.parse(await zip.file('project.json').async('string'))
  if (meta.format !== 'design-space-project') throw new Error('Dit is geen Design Space-projectbestand.')
  const project = { ...meta.project, id: uid() }
  // blobs opnieuw opslaan met nieuwe ids
  for (const f of project.files) {
    for (const v of f.versions) {
      const entry = zip.file(`blobs/${v.blobId}`)
      if (entry) v.blobId = await putBlob(await entry.async('blob'))
    }
  }
  if (meta.preset) {
    const existing = await getPreset(meta.preset.id)
    if (!existing) await savePreset(meta.preset)
  }
  return saveProject(project)
}
