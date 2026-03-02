export function deriveNuId(email: string): string {
    const match = email
        .toLowerCase()
        .match(/^([kilp])(2\d)(\d{4})@nu\.edu\.pk$/)

    if (!match) {
        throw new Error(`Cannot derive nuId: "${email}" is not a valid NU email.`)
    }

    const [, letter, year, serial] = match
    return `${year}${letter.toUpperCase()}-${serial}`
}
