function CompareButton() {
    return (
        <button
            type="button"
            className="compare-button"
            aria-label="Add vehicle to comparison"
        >
            <span className="compare-icon">
                ⇄
            </span>

            <span>
                Compare
            </span>
        </button>
    )
}

export default CompareButton