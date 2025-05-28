# PowerShell script to download all required images for MPI-Strategy-Website

$images = @(
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/08/ICONS.png"; path = "images/ICONS.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2021/09/cr_websitemenuicons_About-MPI-Story.png"; path = "images/cr_websitemenuicons_About-MPI-Story.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/11/cr_websitemenuicons_About-Meet-the-MPI-Team.png"; path = "images/cr_websitemenuicons_About-Meet-the-MPI-Team.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2021/09/cr_websitemenuicons_About-Curtis-Ray.png"; path = "images/cr_websitemenuicons_About-Curtis-Ray.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/11/cr_websitemenuicons_About-Intro-to-MPI.png"; path = "images/cr_websitemenuicons_About-Intro-to-MPI.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2023/07/cr_websitemenuicons_Frequently-Asked-Questions.png"; path = "images/cr_websitemenuicons_Frequently-Asked-Questions.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/12/cr_websitemenuicons_Books.png"; path = "images/cr_websitemenuicons_Books.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2023/07/cr_websitemenuicons_What-is-MPI-Webinars.png"; path = "images/cr_websitemenuicons_What-is-MPI-Webinars.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/11/cr_websitemenuicons_Contact_Client_Support.png"; path = "images/cr_websitemenuicons_Contact_Client_Support.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2021/09/cr_websitemenuicons_About-Tie-Guy.png"; path = "images/cr_websitemenuicons_About-Tie-Guy.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/11/cr_websitemenuicons_About-Careers.png"; path = "images/cr_websitemenuicons_About-Careers.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/08/cr_website-icons-06.png"; path = "images/cr_website-icons-06.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/08/cr_website-icons-08.png"; path = "images/cr_website-icons-08.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/08/cr_website-icons-07.png"; path = "images/cr_website-icons-07.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2021/09/Mobile_BG.png"; path = "images/Mobile_BG.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/08/cr_website-icons-04.png"; path = "images/cr_website-icons-04.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/08/cr_website-icons-05.png"; path = "images/cr_website-icons-05.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/08/cr_website-icons-09.png"; path = "images/cr_website-icons-09.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/08/Everyone-Ends-Up-Poor-Book-Cover.png"; path = "images/Everyone-Ends-Up-Poor-Book-Cover.png" },
    @{ url = "https://compoundinterest.com/wp-content/uploads/2022/08/The-Lost-Science-of-Compound-Interest-Cover-Edited.png"; path = "images/The-Lost-Science-of-Compound-Interest-Cover-Edited.png" }
)

foreach ($img in $images) {
    $dir = Split-Path $img.path -Parent
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
    Invoke-WebRequest -Uri $img.url -OutFile $img.path
    Write-Host "Downloaded $($img.url) to $($img.path)"
}
