// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SharedTodoList",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "SharedTodoList",
            targets: ["SharedTodoList"]
        ),
    ],
    dependencies: [
        // Supabase Swift SDK
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0"),
    ],
    targets: [
        .target(
            name: "SharedTodoList",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
            ],
            path: "SharedTodoList"
        ),
    ]
)
